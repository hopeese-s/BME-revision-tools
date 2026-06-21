const fs = require('fs');
const path = require('path');
const lucide = require('lucide-react');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('src');
const icons = new Set();
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  // Simple regex to match multiline imports
  const match = content.match(/import\s+{([^}]+)}\s+from\s+['"]lucide-react['"]/g);
  if (match) {
    match.forEach(m => {
      const inner = m.match(/{([^}]+)}/)[1];
      inner.split(',').forEach(i => {
        const icon = i.trim();
        if (icon) icons.add(icon);
      });
    });
  }
});

console.log('All icons found:', Array.from(icons));
const missing = Array.from(icons).filter(icon => !lucide[icon]);
console.log('Missing icons:', missing);
