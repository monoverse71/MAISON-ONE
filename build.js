const fs = require('fs'), path = require('path'), esbuild = require('esbuild');
const order = ['00_core.js','01_seed.js','02_repo.js','03_calc.js','04_services.js','05_reports.js','06_kit.jsx','07_charts.jsx','07b_files.jsx','08_forms.jsx','09_pages_a.jsx','10_pages_b.jsx','11_pages_c.jsx','12_pages_d.jsx','12b_print.jsx','13_app.jsx'];
const code = order.map(f => '/* ---- ' + f + ' ---- */\n' + fs.readFileSync(path.join('src', f), 'utf8')).join('\n');
const out = esbuild.transformSync('(function(){\n' + code + '\n})();', { loader: 'jsx', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment', target: 'es2019', charset: 'utf8' });
const css = fs.readFileSync('src/styles.css', 'utf8');
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,500;6..72,600&family=Noto+Sans+Bengali:wght@400;600&display=swap">';
const local = process.argv[2] === 'local';
const scripts = local
  ? '<script>' + fs.readFileSync('node_modules/react/umd/react.production.min.js', 'utf8') + '</script><script>' + fs.readFileSync('node_modules/react-dom/umd/react-dom.production.min.js', 'utf8') + '</script>'
  : '<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>';
const html = '<title>Apon Niketon Holdings</title>\n' + fonts + '\n<style>\n' + css + '\n</style>\n<div id="root"></div>\n<div id="print-root"></div>\n' + scripts + '\n<script>\n' + out.code.replace(/<\/script>/g, '<\\/script>') + '\n</script>\n';
fs.writeFileSync(local ? 'dist_local.html' : 'apon-niketon.html', html);
console.log((local ? 'local' : 'publish') + ' build OK', Math.round(html.length / 1024) + ' KB');
