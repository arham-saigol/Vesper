const fs = require('fs')
const path = require('path')

const srcDir = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist')
const distDir = path.join(__dirname, '..', 'dist')

fs.cpSync(path.join(srcDir, 'cmaps'), path.join(distDir, 'cmaps'), { recursive: true, force: true })
fs.cpSync(path.join(srcDir, 'standard_fonts'), path.join(distDir, 'standard_fonts'), { recursive: true, force: true })
