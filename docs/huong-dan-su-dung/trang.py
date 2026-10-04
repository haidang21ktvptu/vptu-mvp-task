# Lượt 1 → PDF → số trang từng tiêu đề (tieu-de.json) → trang.json cho lượt 2.
import json, re, subprocess, sys
pdf = sys.argv[1] if len(sys.argv) > 1 else 'HDSD-VPTU-TASK.pdf'
n = int(re.search(r'Pages:\s+(\d+)', subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout).group(1))
norm = lambda t: re.sub(r'\s+', ' ', t).strip()
pages = []
for i in range(1, n + 1):
    t = subprocess.run(['pdftotext', '-f', str(i), '-l', str(i), '-layout', pdf, '-'], capture_output=True, text=True).stdout
    pages.append(norm(t))
tieude = json.load(open('tieu-de.json', encoding='utf-8'))
# trang mục lục = những trang đầu có chấm dẫn '.....'; tìm tiêu đề từ sau trang mục lục cuối
toc_end = max([i for i, pg in enumerate(pages[:6]) if '......' in pg] or [1])
print('mục lục tới trang', toc_end + 1)
ket = {}
thieu = []
for td in tieude:
    ten = norm(td['ten'])
    tim = next((i + 1 for i, pg in enumerate(pages) if i > toc_end and ten in pg), None)
    if tim: ket[td['ten']] = tim
    else: thieu.append(ten)
json.dump(ket, open('trang.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('trang:', n, '| tiêu đề tìm thấy:', len(ket), '/', len(tieude))
if thieu: print('KHÔNG THẤY:', thieu)
