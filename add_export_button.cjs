const fs = require('fs');
let content = fs.readFileSync('src/components/WarehouseTab.tsx', 'utf-8');

const exportBtn = `
              <button
                onClick={handleExportHistoryToExcel}
                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded border border-emerald-200 text-xs font-bold ml-auto flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
                Xuất Excel
              </button>
`;

content = content.replace(
  `              <button
                onClick={() => fetchHistory(historyProduct, historyStartDate, historyEndDate)}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded border border-indigo-200 text-xs font-bold"
              >
                Lọc
              </button>`,
  `              <button
                onClick={() => fetchHistory(historyProduct, historyStartDate, historyEndDate)}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded border border-indigo-200 text-xs font-bold"
              >
                Lọc
              </button>${exportBtn}`
);

fs.writeFileSync('src/components/WarehouseTab.tsx', content);
