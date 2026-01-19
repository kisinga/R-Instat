# Development Notes

## R Setup

Install R systemwide (the app will auto-install required packages on first launch).

For manual package installation (if needed):

```bash
Rscript -e "install.packages(c('jsonlite', 'dplyr', 'tidyr', 'ggplot2', 'sjPlot', 'sjmisc', 'skimr'), repos='https://cloud.r-project.org')"
```

> **Note**: The app automatically detects missing packages and prompts for installation with a progress UI.