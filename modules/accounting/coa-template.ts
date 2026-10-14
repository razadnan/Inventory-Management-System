export type AccountTemplate = {
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
  parentCode?: string;
  isGroup?: boolean;
  isSystem?: boolean;
  cashFlowClass?: "OPERATING" | "INVESTING" | "FINANCING" | "CASH";
};

/**
 * Starter chart of accounts for an Indian business.
 * Parents always appear before their children.
 * System accounts are used by automatic postings and cannot be deleted.
 */
export const INDIA_COA_TEMPLATE: AccountTemplate[] = [
  // Assets
  { code: "1000", name: "Current Assets", type: "ASSET", isGroup: true },
  { code: "1010", name: "Cash in Hand", type: "ASSET", parentCode: "1000", isSystem: true, cashFlowClass: "CASH" },
  { code: "1020", name: "Bank Account", type: "ASSET", parentCode: "1000", isSystem: true, cashFlowClass: "CASH" },
  { code: "1100", name: "Accounts Receivable", type: "ASSET", parentCode: "1000", isSystem: true, cashFlowClass: "OPERATING" },
  { code: "1200", name: "Inventory", type: "ASSET", parentCode: "1000", isSystem: true, cashFlowClass: "OPERATING" },
  { code: "1300", name: "Input CGST", type: "ASSET", parentCode: "1000", isSystem: true, cashFlowClass: "OPERATING" },
  { code: "1310", name: "Input SGST", type: "ASSET", parentCode: "1000", isSystem: true, cashFlowClass: "OPERATING" },
  { code: "1320", name: "Input IGST", type: "ASSET", parentCode: "1000", isSystem: true, cashFlowClass: "OPERATING" },
  { code: "1400", name: "Advances to Suppliers", type: "ASSET", parentCode: "1000", cashFlowClass: "OPERATING" },
  { code: "1500", name: "TDS / TCS Receivable", type: "ASSET", parentCode: "1000", cashFlowClass: "OPERATING" },

  { code: "1600", name: "Fixed Assets", type: "ASSET", isGroup: true },
  { code: "1610", name: "Plant and Machinery", type: "ASSET", parentCode: "1600", cashFlowClass: "INVESTING" },
  { code: "1620", name: "Furniture and Fixtures", type: "ASSET", parentCode: "1600", cashFlowClass: "INVESTING" },
  { code: "1630", name: "Computers and Equipment", type: "ASSET", parentCode: "1600", cashFlowClass: "INVESTING" },
  { code: "1690", name: "Accumulated Depreciation", type: "ASSET", parentCode: "1600", cashFlowClass: "INVESTING" },

  // Liabilities
  { code: "2000", name: "Current Liabilities", type: "LIABILITY", isGroup: true },
  { code: "2100", name: "Accounts Payable", type: "LIABILITY", parentCode: "2000", isSystem: true, cashFlowClass: "OPERATING" },
  { code: "2200", name: "Output CGST", type: "LIABILITY", parentCode: "2000", isSystem: true, cashFlowClass: "OPERATING" },
  { code: "2210", name: "Output SGST", type: "LIABILITY", parentCode: "2000", isSystem: true, cashFlowClass: "OPERATING" },
  { code: "2220", name: "Output IGST", type: "LIABILITY", parentCode: "2000", isSystem: true, cashFlowClass: "OPERATING" },
  { code: "2300", name: "TDS Payable", type: "LIABILITY", parentCode: "2000", cashFlowClass: "OPERATING" },
  { code: "2400", name: "Advances from Customers", type: "LIABILITY", parentCode: "2000", cashFlowClass: "OPERATING" },
  { code: "2500", name: "Other Current Liabilities", type: "LIABILITY", parentCode: "2000", cashFlowClass: "OPERATING" },

  { code: "2700", name: "Loans", type: "LIABILITY", isGroup: true },
  { code: "2710", name: "Bank Loan", type: "LIABILITY", parentCode: "2700", cashFlowClass: "FINANCING" },

  // Equity
  { code: "3000", name: "Owner's Equity", type: "EQUITY", isGroup: true },
  { code: "3010", name: "Capital", type: "EQUITY", parentCode: "3000", cashFlowClass: "FINANCING" },
  { code: "3020", name: "Drawings", type: "EQUITY", parentCode: "3000", cashFlowClass: "FINANCING" },
  { code: "3030", name: "Retained Earnings", type: "EQUITY", parentCode: "3000", isSystem: true, cashFlowClass: "FINANCING" },

  // Income
  { code: "4000", name: "Revenue", type: "INCOME", isGroup: true },
  { code: "4010", name: "Sales", type: "INCOME", parentCode: "4000", isSystem: true },
  { code: "4020", name: "Sales Returns", type: "INCOME", parentCode: "4000", isSystem: true },
  { code: "4030", name: "Other Income", type: "INCOME", parentCode: "4000" },
  { code: "4040", name: "Interest Income", type: "INCOME", parentCode: "4000" },

  // Expenses
  { code: "5000", name: "Cost of Goods Sold", type: "EXPENSE", isGroup: true },
  { code: "5010", name: "Cost of Goods Sold", type: "EXPENSE", parentCode: "5000", isSystem: true },
  { code: "5030", name: "Inventory Adjustments", type: "EXPENSE", parentCode: "5000", isSystem: true },

  { code: "5100", name: "Operating Expenses", type: "EXPENSE", isGroup: true },
  { code: "5110", name: "Rent", type: "EXPENSE", parentCode: "5100" },
  { code: "5120", name: "Salaries and Wages", type: "EXPENSE", parentCode: "5100" },
  { code: "5130", name: "Electricity and Utilities", type: "EXPENSE", parentCode: "5100" },
  { code: "5140", name: "Office Expenses", type: "EXPENSE", parentCode: "5100" },
  { code: "5150", name: "Professional Fees", type: "EXPENSE", parentCode: "5100" },
  { code: "5160", name: "Travel and Conveyance", type: "EXPENSE", parentCode: "5100" },
  { code: "5170", name: "Marketing and Advertising", type: "EXPENSE", parentCode: "5100" },
  { code: "5180", name: "Repairs and Maintenance", type: "EXPENSE", parentCode: "5100" },
  { code: "5190", name: "Bank Charges", type: "EXPENSE", parentCode: "5100", isSystem: true },
  { code: "5200", name: "Depreciation", type: "EXPENSE", parentCode: "5100" },
  { code: "5210", name: "Interest Expense", type: "EXPENSE", parentCode: "5100" },
  { code: "5900", name: "Round Off", type: "EXPENSE", parentCode: "5100", isSystem: true },
];