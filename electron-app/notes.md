Install R systemwide

mkdir -p ~/R/x86_64-pc-linux-gnu-library/4.5 && Rscript -e "install.packages(c('jsonlite', 'dplyr', 'ggplot2', 'tidyr'), repos='https://cloud.r-project.org', lib='~/R/x86_64-pc-linux-gnu-library/4.5')"