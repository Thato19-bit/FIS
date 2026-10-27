# ABC Finance — Financial Information Systems Dashboard

A responsive FIS course project inspired by the supplied dashboard reference. React + Bootstrap frontend, Express API, MongoDB database, CRUD actions, ratio analysis, search, year/quarter filters, dark mode, and CSV export.

## Requirements
- Node.js LTS and npm
- Visual Studio Code
- MongoDB Community Server running locally (MongoDB Compass is a GUI client; Compass alone does not provide the database server)

## 1. Start MongoDB
Install/start MongoDB Community Server. Open MongoDB Compass and connect to:
`mongodb://127.0.0.1:27017`

The app uses database `fis_finance_dashboard` and collection `financialrecords`. It seeds demo records automatically if the collection is empty.

## 2. Install
Extract the ZIP, open the `ABC_Finance_FIS_Dashboard` folder in VS Code, then open Terminal > New Terminal and run:

```bash
npm run install:all
```

## 3. Run the app
In the same terminal:

```bash
npm run dev
```

Frontend: `http://localhost:5173`
Backend health check: `http://localhost:5000/api/health`

Keep the terminal running while using the dashboard.

## MongoDB Compass
1. Open Compass.
2. Use `mongodb://127.0.0.1:27017` and connect.
3. After the app runs, refresh the databases list.
4. Open `fis_finance_dashboard` > `financialrecords`.
5. Add/edit/delete through the app and refresh Compass to see persisted changes.

## If MongoDB uses another URI
Create `server/.env` based on `.env.example`, and set `MONGODB_URI` to your own connection string. Never share real database passwords.

## Features
- Dashboard, Balance Sheet, Ratio Analysis, Records, About, Blog, FAQs, Contact Us pages (working navigation)
- MongoDB-backed create, read, update, delete operations
- Search records and filter by year/quarter
- Editable financial data and automatic ratio calculations
- Asset/liability/equity visual bars
- CSV export
- Responsive layout and light/dark theme toggle
- Connection status and error messages

## Ratio formulas
- Current ratio = current assets / current liabilities
- Quick ratio = (current assets - inventory) / current liabilities
- Working capital = current assets - current liabilities
- Debt-to-assets = total liabilities / total assets × 100
- Debt-to-equity = total liabilities / equity × 100
- Equity ratio = equity / total assets × 100

## Academic notes
The company and figures are fictional sample data for the FIS module. Use the currency/financial year required by your lecturer. Balance sheet data alone cannot calculate profitability ratios such as net profit margin or return on assets. Always explain that this is a demonstration, not a real company's financial report.
