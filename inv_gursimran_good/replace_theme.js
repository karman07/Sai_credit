const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'manager/app/dashboard/inventory/page.tsx',
  'manager/app/dashboard/sales/page.tsx'
];

filesToUpdate.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace maroon hex codes with blue hex codes
    content = content.replace(/#7A1C2A/g, '#2563EB'); // blue-600
    content = content.replace(/#5E1520/g, '#1D4ED8'); // blue-700
    content = content.replace(/#5A0F1A/g, '#1E40AF'); // blue-800
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated theme in ${file}`);
  } else {
    console.log(`File not found: ${file}`);
  }
});
