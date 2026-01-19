# R-Instat Next (Electron MVP)

Cross-platform statistical analysis application powered by R, built with Electron and Angular.

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **R** 4.0+ installed and accessible in PATH

> **Note**: Required R packages (`jsonlite`, `dplyr`, `tidyr`, `ggplot2`, `sjPlot`, `sjmisc`, `skimr`) are automatically installed on first launch if missing. The app will display a progress dialog during installation.

## Quick Start

```bash
# Install dependencies
npm install

# Start development mode (Angular dev server + Electron)
npm run electron:dev

# Build for production
npm run electron:build
```

## Development

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron + Angular                        │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────────┐  │
│  │  Data Grid    │  │  Dialogs      │  │  Output Panel   │  │
│  │  (AG Grid)    │  │  (15 stats)   │  │  (text+plots)   │  │
│  └───────┬───────┘  └───────┬───────┘  └────────┬────────┘  │
│          └──────────────────┼───────────────────┘           │
│                             │                                │
│  ┌──────────────────────────▼──────────────────────────────┐│
│  │              R Service (IPC Bridge)                     ││
│  └──────────────────────────┬──────────────────────────────┘│
└─────────────────────────────┼───────────────────────────────┘
                              │ Child Process (stdio JSON)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    R Process                                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  bridge.R (JSON interface)                              ││
│  │  + dplyr, ggplot2, tidyr, sjPlot, sjmisc, skimr         ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Project Structure

```
electron-app/
├── electron/           # Electron main process
│   ├── main.ts         # App entry, window management
│   ├── preload.ts      # Secure IPC bridge
│   └── r-bridge.ts     # R process communication
├── src/                # Angular renderer process
│   ├── app/
│   │   ├── core/       # Services, models
│   │   ├── layout/     # Shell, menubar, toolbar, statusbar
│   │   ├── features/   # Data view, output, dialogs
│   │   └── shared/     # Reusable components
│   └── styles.css      # Tailwind + DaisyUI
├── r-backend/          # R scripts
│   └── bridge.R        # JSON stdio bridge
└── assets/
    └── demo-data/      # Sample datasets
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Angular dev server only |
| `npm run electron:dev` | Start Angular + Electron with hot reload |
| `npm run electron:start` | Start Electron (requires built Angular) |
| `npm run electron:build` | Build production app |
| `npm run build` | Build Angular only |

### Adding a New Dialog

1. Create component in `src/app/features/dialogs/<name>/`
2. Extend `DialogBase` class
3. Implement `buildRCode()` and `isValid()` methods
4. Register in `dialog-host.component.ts`
5. Add menu entry in `electron/main.ts`

Example:
```typescript
@Component({...})
export class MyDialogComponent extends DialogBase {
  readonly dialogTitle = 'My Dialog';
  
  buildRCode(): string {
    return `# R code here`;
  }
  
  isValid(): boolean {
    return true;
  }
}
```

## Features (MVP)

### Data Operations
- Import CSV/Excel files
- Filter, sort, rename columns
- Calculate new columns
- Recode values

### Visualization
- Histogram
- Box Plot
- Scatter Plot
- Bar Chart

### Statistics
- Summary statistics
- Correlation analysis
- t-Test (one sample, two sample, paired)
- Linear regression

## Tech Stack

- **Frontend**: Angular 19, Tailwind CSS, DaisyUI
- **Desktop**: Electron 33
- **Data Grid**: AG Grid Community
- **Backend**: R with jsonlite

## License

GPL-3.0 - See [LICENSE](../LICENCE) for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

**R-Instat** is developed by [IDEMS International](https://www.idems.international/).
