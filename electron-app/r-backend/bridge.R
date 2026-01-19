# R-Instat Bridge
# JSON over stdio communication with Electron
#
# This script runs as a child process of Electron and handles
# all R operations via JSON messages.

# ============================================================================
# Package Check and Healthcheck System
# ============================================================================

required_packages <- c("jsonlite", "dplyr", "tidyr", "ggplot2", "GGally", "sjPlot", "sjmisc", "skimr")

# Check for missing packages BEFORE loading
missing_packages <- required_packages[!sapply(required_packages, requireNamespace, quietly = TRUE)]

# Track if we're in install mode (waiting for install command)
install_mode <- FALSE

if (length(missing_packages) > 0) {
  # jsonlite is required for JSON communication - if missing, this is fatal
  if ("jsonlite" %in% missing_packages) {
    # Can't send JSON without jsonlite - output plain text error and exit
    cat("FATAL: jsonlite package is required but not installed.\n")
    cat("Please run: install.packages('jsonlite')\n")
    quit(status = 1)
  }
  
  # Load jsonlite to send structured response
  suppressPackageStartupMessages(library(jsonlite))
  
  # Send missing packages status
  cat(toJSON(list(
    ready = FALSE, 
    missing_packages = I(missing_packages)
  ), auto_unbox = TRUE), "\n")
  flush(stdout())
  
  # Enter install mode - wait for install_packages command
  install_mode <- TRUE
  stdin_con <- file("stdin", "r", blocking = TRUE)
  
  while (install_mode) {
    line <- tryCatch({
      readLines(con = stdin_con, n = 1, warn = FALSE)
    }, error = function(e) { character(0) })
    
    if (length(line) == 0 || line == "") {
      Sys.sleep(0.1)
      next
    }
    
    cmd <- tryCatch(fromJSON(line), error = function(e) NULL)
    if (is.null(cmd)) next
    
    if (!is.null(cmd$type) && cmd$type == "install_packages") {
      # Install missing packages
      packages_to_install <- if (!is.null(cmd$packages)) cmd$packages else missing_packages
      total <- length(packages_to_install)
      
      for (i in seq_along(packages_to_install)) {
        pkg <- packages_to_install[i]
        
        # Send progress update
        cat(toJSON(list(
          type = "install_progress",
          package = pkg,
          current = i,
          total = total
        ), auto_unbox = TRUE), "\n")
        flush(stdout())
        
        # Install package
        tryCatch({
          install.packages(pkg, repos = "https://cloud.r-project.org", quiet = TRUE)
        }, error = function(e) {
          message(paste("Failed to install", pkg, ":", e$message))
        })
      }
      
      # Re-check for missing packages
      still_missing <- packages_to_install[!sapply(packages_to_install, requireNamespace, quietly = TRUE)]
      
      if (length(still_missing) > 0) {
        # Some packages still missing
        cat(toJSON(list(
          id = cmd$id,
          success = FALSE,
          error = paste("Failed to install:", paste(still_missing, collapse = ", ")),
          still_missing = I(still_missing)
        ), auto_unbox = TRUE), "\n")
        flush(stdout())
      } else {
        # All installed successfully - exit install mode
        cat(toJSON(list(
          id = cmd$id,
          success = TRUE
        ), auto_unbox = TRUE), "\n")
        flush(stdout())
        install_mode <- FALSE
      }
    }
  }
  
  close(stdin_con)
}

# Load all required packages with error handling
tryCatch({
  suppressPackageStartupMessages({
    library(jsonlite)
    library(dplyr)
    library(tidyr)
    library(ggplot2)
    library(GGally)
    library(sjPlot)
    library(sjmisc)
    library(skimr)
  })
}, error = function(e) {
  # If we can't load packages after install, report the error
  if (requireNamespace("jsonlite", quietly = TRUE)) {
    cat(jsonlite::toJSON(list(
      ready = FALSE,
      error = paste("Failed to load packages:", e$message)
    ), auto_unbox = TRUE), "\n")
    flush(stdout())
  } else {
    cat("FATAL: Failed to load required packages:", e$message, "\n")
  }
  quit(status = 1)
})

# Global data storage (simple for MVP - no databook dependency initially)
data_store <- new.env()

# Demo data path from environment
demo_data_path <- Sys.getenv("RINSTAT_DEMO_DATA", "")

# Instat collection path from environment
collection_path <- Sys.getenv("RINSTAT_COLLECTION_PATH", "")

# ============================================================================
# JSON Serialization Utilities (Composable)
# ============================================================================

#' Mark a value to always serialize as a JSON array
#' Use this for any result that should remain an array even with 0 or 1 element
#' @param x Vector or list to mark as array
#' @return AsIs class object that jsonlite serializes as array
as_json_array <- function(x) {
  if (is.null(x) || length(x) == 0) {
    return(I(character(0)))  # Empty array
  }
  I(as.character(x))
}

#' Send JSON response to stdout
#' @param response List to serialize and send
send_response <- function(response) {
  cat(toJSON(response, auto_unbox = TRUE, null = "null"), "\n")
  flush(stdout())
}

#' Create a success response with consistent structure
#' @param id Command ID
#' @param result Result data
make_success <- function(id, result) {
  list(id = id, success = TRUE, result = result)
}

#' Create an error response with consistent structure
#' @param id Command ID
#' @param message Error message
make_error <- function(id, message) {
  list(id = id, success = FALSE, error = message)
}

#' Wrap handler execution with error handling
#' @param cmd Command object (must have $id)
#' @param handler_fn Function to execute
with_error_handling <- function(cmd, handler_fn) {
  tryCatch(
    handler_fn(),
    error = function(e) {
      message(paste("Error:", e$message))
      make_error(cmd$id, e$message)
    }
  )
}

# ============================================================================
# Output Utilities
# ============================================================================

#' Capture R output as text
capture_output <- function(expr) {
  output <- capture.output(expr)
  paste(output, collapse = "\n")
}

#' Handle execute command
#' Evaluates R code and returns appropriate result type (plot, dataframe, or text)
handle_execute <- function(cmd) {
  tryCatch({
    # Evaluate directly - avoid capture.output with superassignment which has scoping issues
    result <- eval(parse(text = cmd$code))
    
    # Determine result type and format response
    # Check for ggplot, gg, or ggmatrix (from GGally::ggpairs)
    is_plot <- inherits(result, "ggplot") || inherits(result, "gg") || inherits(result, "ggmatrix")
    
    if (is_plot) {
      # Save plot to temp file and encode as base64
      tmp_file <- tempfile(fileext = ".png")
      # For ggmatrix objects, we need to use print() to render, then ggsave
      # ggsave works with ggmatrix in recent GGally versions
      suppressMessages(ggplot2::ggsave(tmp_file, result, width = 10, height = 7, dpi = 150))
      
      # Read file as raw bytes and encode as base64 data URL
      raw_data <- readBin(tmp_file, "raw", file.info(tmp_file)$size)
      plot_base64 <- jsonlite::base64_enc(raw_data)
      data_url <- paste0("data:image/png;base64,", plot_base64)
      
      # Clean up temp file
      unlink(tmp_file)
      
      list(
        id = cmd$id,
        success = TRUE,
        result = list(
          type = "plot",
          dataUrl = data_url
        )
      )
    } else if (is.data.frame(result)) {
      # Return dataframe preview
      list(
        id = cmd$id,
        success = TRUE,
        result = list(
          type = "dataframe",
          data = head(result, 100),
          columns = names(result),
          totalRows = nrow(result)
        )
      )
    } else {
      # For other results, capture the print output
      text_output <- capture.output(print(result))
      combined <- paste(text_output, collapse = "\n")
      combined <- trimws(combined)
      
      list(
        id = cmd$id,
        success = TRUE,
        result = list(
          type = "text",
          value = if (nchar(combined) > 0) combined else "NULL"
        )
      )
    }
  }, error = function(e) {
    list(
      id = cmd$id,
      success = FALSE,
      error = e$message
    )
  })
}

#' Handle get_dataframes command
handle_get_dataframes <- function(cmd) {
  with_error_handling(cmd, function() {
    names <- ls(envir = data_store)
    df_names <- names[sapply(names, function(n) {
      is.data.frame(get(n, envir = data_store))
    })]
    make_success(cmd$id, as_json_array(df_names))
  })
}

#' Handle get_data_preview command with pagination support
handle_get_data_preview <- function(cmd) {
  tryCatch({
    df_name <- cmd$name
    limit <- if (!is.null(cmd$limit)) cmd$limit else 100
    offset <- if (!is.null(cmd$offset)) cmd$offset else 0
    
    if (!exists(df_name, envir = data_store)) {
      stop(paste("Dataframe not found:", df_name))
    }
    
    df <- get(df_name, envir = data_store)
    total_rows <- nrow(df)
    
    # Get column types with proper R type detection
    col_types <- sapply(df, function(x) {
      if (is.ordered(x)) return("ordered_factor")
      if (is.factor(x)) return("factor")
      if (inherits(x, "Date") || inherits(x, "POSIXt")) return("date")
      if (is.logical(x)) return("logical")
      if (is.numeric(x)) return("numeric")
      if (is.character(x)) return("character")
      paste(class(x), collapse = ", ")
    })
    
    # Calculate row range with bounds checking
    start_row <- min(offset + 1, total_rows)
    end_row <- min(offset + limit, total_rows)
    
    # Get paginated rows
    if (start_row <= end_row && total_rows > 0) {
      preview_df <- df[start_row:end_row, , drop = FALSE]
      
      # Convert to list of rows for JSON
      rows <- lapply(1:nrow(preview_df), function(i) {
        as.list(preview_df[i, , drop = FALSE])
      })
    } else {
      rows <- list()
    }
    
    list(
      id = cmd$id,
      success = TRUE,
      result = list(
        columns = names(df),
        columnTypes = as.list(col_types),
        rows = rows,
        totalRows = total_rows,
        offset = offset,
        limit = limit
      )
    )
  }, error = function(e) {
    list(
      id = cmd$id,
      success = FALSE,
      error = e$message
    )
  })
}

#' Handle get_columns command
handle_get_columns <- function(cmd) {
  with_error_handling(cmd, function() {
    df_name <- cmd$name
    if (!exists(df_name, envir = data_store)) {
      stop(paste("Dataframe not found:", df_name))
    }
    df <- get(df_name, envir = data_store)
    make_success(cmd$id, as_json_array(names(df)))
  })
}

#' Handle get_column_types command
handle_get_column_types <- function(cmd) {
  tryCatch({
    df_name <- cmd$name
    
    if (!exists(df_name, envir = data_store)) {
      stop(paste("Dataframe not found:", df_name))
    }
    
    df <- get(df_name, envir = data_store)
    
    col_types <- sapply(df, function(x) {
      paste(class(x), collapse = ", ")
    })
    
    list(
      id = cmd$id,
      success = TRUE,
      result = as.list(col_types)
    )
  }, error = function(e) {
    list(
      id = cmd$id,
      success = FALSE,
      error = e$message
    )
  })
}

#' Handle load_demo command
handle_load_demo <- function(cmd) {
  tryCatch({
    # Try to find demo data
    demo_paths <- c(
      file.path(demo_data_path, "wb_tanzania.rds"),
      file.path(demo_data_path, "WB_Rawdata_Tz.RDS"),
      # Also check relative to script location
      "../assets/demo-data/wb_tanzania.rds",
      "../../instat/static/InstatObject/R/WB_Rawdata_Tz.RDS"
    )
    
    demo_file <- NULL
    for (p in demo_paths) {
      if (file.exists(p)) {
        demo_file <- p
        break
      }
    }
    
    if (is.null(demo_file)) {
      # Create sample demo data if no file found
      message("Creating sample demo data...")
      wb_data <- data.frame(
        country = rep("Tanzania", 100),
        year = rep(2010:2019, each = 10),
        indicator = sample(c("GDP", "Population", "Life Expectancy", "Literacy Rate", "Poverty Rate"), 100, replace = TRUE),
        value = runif(100, 0, 100),
        region = sample(c("Dar es Salaam", "Arusha", "Mwanza", "Dodoma", "Zanzibar"), 100, replace = TRUE)
      )
      assign("wb_data", wb_data, envir = data_store)
    } else {
      # Load from file
      message(paste("Loading demo data from:", demo_file))
      demo_data <- readRDS(demo_file)
      assign("wb_data", demo_data, envir = data_store)
    }
    
    list(
      id = cmd$id,
      success = TRUE,
      result = list(
        type = "text",
        value = "Demo data loaded successfully"
      )
    )
  }, error = function(e) {
    list(
      id = cmd$id,
      success = FALSE,
      error = e$message
    )
  })
}

#' Handle list_instat_collection command
#' Auto-discovers datasets from the instat collection folder
handle_list_instat_collection <- function(cmd) {
  with_error_handling(cmd, function() {
    if (collection_path == "" || !dir.exists(collection_path)) {
      return(make_success(cmd$id, list(datasets = list())))
    }
    
    # Find all data files in the collection folder
    files <- list.files(
      collection_path, 
      pattern = "\\.(rds|RDS|csv|CSV|xlsx|xls)$", 
      full.names = TRUE
    )
    
    if (length(files) == 0) {
      return(make_success(cmd$id, list(datasets = list())))
    }
    
    # Build dataset list from discovered files
    datasets <- lapply(files, function(f) {
      filename <- basename(f)
      name <- tools::file_path_sans_ext(filename)
      ext <- tolower(tools::file_ext(filename))
      
      # Create human-readable title from filename
      title <- gsub("_", " ", name)
      title <- tools::toTitleCase(title)
      
      list(
        name = name,
        filename = filename,
        path = f,
        title = title,
        format = ext
      )
    })
    
    make_success(cmd$id, list(datasets = datasets))
  })
}

#' Handle load_instat_collection_dataset command
#' Loads a dataset from the instat collection folder
handle_load_instat_collection_dataset <- function(cmd) {
  with_error_handling(cmd, function() {
    file_path <- cmd$path
    dataset_name <- cmd$name
    
    if (is.null(file_path) || !file.exists(file_path)) {
      stop(paste("File not found:", file_path))
    }
    
    if (is.null(dataset_name)) {
      dataset_name <- tools::file_path_sans_ext(basename(file_path))
    }
    
    # Determine file type and load accordingly
    ext <- tolower(tools::file_ext(file_path))
    
    data <- switch(ext,
      "rds" = readRDS(file_path),
      "csv" = read.csv(file_path, stringsAsFactors = FALSE),
      "xlsx" = {
        if (requireNamespace("readxl", quietly = TRUE)) {
          readxl::read_excel(file_path)
        } else {
          stop("readxl package required for Excel files")
        }
      },
      "xls" = {
        if (requireNamespace("readxl", quietly = TRUE)) {
          readxl::read_excel(file_path)
        } else {
          stop("readxl package required for Excel files")
        }
      },
      stop(paste("Unsupported file format:", ext))
    )
    
    # Convert to data.frame if needed
    if (!is.data.frame(data)) {
      data <- as.data.frame(data)
    }
    
    # Store in data_store
    assign(dataset_name, data, envir = data_store)
    
    make_success(cmd$id, list(
      type = "text",
      value = paste("Loaded", dataset_name, "(", nrow(data), "rows,", ncol(data), "columns)")
    ))
  })
}

#' Handle import_file command
#' Imports a file from user-specified path with configurable options
handle_import_file <- function(cmd) {
  with_error_handling(cmd, function() {
    file_path <- cmd$path
    dataset_name <- cmd$name
    
    if (is.null(file_path) || !file.exists(file_path)) {
      stop(paste("File not found:", file_path))
    }
    
    if (is.null(dataset_name) || dataset_name == "") {
      dataset_name <- tools::file_path_sans_ext(basename(file_path))
      # Sanitize name for R variable
      dataset_name <- gsub("[^a-zA-Z0-9_]", "_", dataset_name)
    }
    
    # Get import options with defaults
    separator <- if (!is.null(cmd$separator)) cmd$separator else ","
    decimal <- if (!is.null(cmd$decimal)) cmd$decimal else "."
    has_header <- if (!is.null(cmd$hasHeader)) cmd$hasHeader else TRUE
    
    # Determine file type and load accordingly
    ext <- tolower(tools::file_ext(file_path))
    
    data <- switch(ext,
      "csv" = read.csv(file_path, sep = separator, dec = decimal, header = has_header, stringsAsFactors = FALSE),
      "tsv" = read.csv(file_path, sep = "\t", dec = decimal, header = has_header, stringsAsFactors = FALSE),
      "txt" = read.csv(file_path, sep = separator, dec = decimal, header = has_header, stringsAsFactors = FALSE),
      "xlsx" = {
        if (requireNamespace("readxl", quietly = TRUE)) {
          as.data.frame(readxl::read_excel(file_path))
        } else {
          stop("readxl package required for Excel files. Install with: install.packages('readxl')")
        }
      },
      "xls" = {
        if (requireNamespace("readxl", quietly = TRUE)) {
          as.data.frame(readxl::read_excel(file_path))
        } else {
          stop("readxl package required for Excel files. Install with: install.packages('readxl')")
        }
      },
      "rds" = readRDS(file_path),
      stop(paste("Unsupported file format:", ext, ". Supported formats: csv, tsv, txt, xlsx, xls, rds"))
    )
    
    # Convert to data.frame if needed (for tibbles etc.)
    if (!is.data.frame(data)) {
      data <- as.data.frame(data)
    }
    
    # Store in data_store
    assign(dataset_name, data, envir = data_store)
    
    make_success(cmd$id, list(
      type = "text",
      value = paste("Imported", dataset_name, "(", nrow(data), "rows,", ncol(data), "columns)")
    ))
  })
}

#' Handle list_package_datasets command
#' Lists all datasets available from installed R packages
handle_list_package_datasets <- function(cmd) {
  with_error_handling(cmd, function() {
    # Get datasets from all available packages
    pkg_data <- data(package = .packages(all.available = TRUE))$results
    
    # Convert to list of dataset objects
    datasets <- lapply(1:nrow(pkg_data), function(i) {
      list(
        package = pkg_data[i, "Package"],
        name = pkg_data[i, "Item"],
        title = pkg_data[i, "Title"]
      )
    })
    
    make_success(cmd$id, list(datasets = datasets))
  })
}

#' Handle load_package_dataset command
#' Loads a specific dataset from an R package into the data store
handle_load_package_dataset <- function(cmd) {
  with_error_handling(cmd, function() {
    pkg <- cmd$package
    dataset <- cmd$dataset
    
    if (is.null(pkg) || is.null(dataset)) {
      stop("Package and dataset name are required")
    }
    
    # Create a temporary environment to load the data
    temp_env <- new.env()
    
    # Load the dataset
    data(list = dataset, package = pkg, envir = temp_env)
    
    # Get all objects created in the temp environment
    loaded_names <- ls(envir = temp_env)
    
    if (length(loaded_names) == 0) {
      stop(paste("No data found for", dataset, "in package", pkg))
    }
    
    # Copy all loaded objects to data_store
    for (name in loaded_names) {
      obj <- get(name, envir = temp_env)
      # Only store data frames
      if (is.data.frame(obj)) {
        assign(name, obj, envir = data_store)
      }
    }
    
    make_success(cmd$id, list(
      type = "text",
      value = paste("Loaded", paste(loaded_names, collapse = ", "), "from", pkg)
    ))
  })
}

#' Route command to appropriate handler
handle_command <- function(cmd) {
  switch(cmd$type,
    "execute" = handle_execute(cmd),
    "get_dataframes" = handle_get_dataframes(cmd),
    "get_data_preview" = handle_get_data_preview(cmd),
    "get_columns" = handle_get_columns(cmd),
    "get_column_types" = handle_get_column_types(cmd),
    "load_demo" = handle_load_demo(cmd),
    "list_package_datasets" = handle_list_package_datasets(cmd),
    "load_package_dataset" = handle_load_package_dataset(cmd),
    "list_instat_collection" = handle_list_instat_collection(cmd),
    "load_instat_collection_dataset" = handle_load_instat_collection_dataset(cmd),
    "import_file" = handle_import_file(cmd),
    list(
      id = cmd$id,
      success = FALSE,
      error = paste("Unknown command type:", cmd$type)
    )
  )
}

#' Main loop - read JSON from stdin, process, write JSON to stdout
main <- function() {
  # Open stdin connection explicitly
  stdin_con <- file("stdin", "r", blocking = TRUE)
  on.exit(close(stdin_con))
  
  # Signal ready
  send_response(list(ready = TRUE))
  
  # Process commands
  repeat {
    line <- tryCatch({
      readLines(con = stdin_con, n = 1, warn = FALSE)
    }, error = function(e) {
      character(0)
    })
    
    if (length(line) == 0) {
      # EOF - exit
      break
    }
    
    if (nchar(trimws(line)) == 0) {
      next
    }
    
    tryCatch({
      cmd <- fromJSON(line)
      response <- handle_command(cmd)
      send_response(response)
    }, error = function(e) {
      send_response(list(
        id = if (exists("cmd") && !is.null(cmd$id)) cmd$id else "unknown",
        success = FALSE,
        error = paste("Parse error:", e$message)
      ))
    })
  }
}

# Expose data_store functions for execute commands
# These let executed R code interact with the data store
add_dataframe <- function(name, df) {
  assign(name, df, envir = data_store)
}

get_dataframe <- function(name) {
  if (exists(name, envir = data_store)) {
    get(name, envir = data_store)
  } else {
    NULL
  }
}

list_dataframes <- function() {
  names <- ls(envir = data_store)
  names[sapply(names, function(n) is.data.frame(get(n, envir = data_store)))]
}

# Start main loop
main()
