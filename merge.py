import glob
from pypdf import PdfWriter, PdfReader
from PIL import Image
w = PdfWriter()
for f in sorted(glob.glob('out/p*.pdf')): w.add_page(PdfReader(f).pages[0])
w.add_metadata({'/Title': 'SNMP - Simple Network Management Protocol', '/Author': 'Bilarab Suwailam Almusallami (32J2324)', '/Subject': 'Advanced Computer Network course presentation'})
w.write('out/SNMP_Presentation_Bilarab_Almusallami.pdf')
ims = [Image.open(f).convert('RGB') for f in sorted(glob.glob('out/s*.png'))]
ims[0].save('out/SNMP_Slides_Images.pdf', save_all=True, append_images=ims[1:], resolution=150)
sheet = Image.new('RGB', (400 * 3, 225 * ((len(ims) + 2) // 3)), 'white')
for i, im in enumerate(ims): sheet.paste(im.resize((400, 225)), ((i % 3) * 400, (i // 3) * 225))
sheet.save('out/sheet.jpg', quality=80)
import subprocess; print(subprocess.run(['pdftotext', 'out/SNMP_Presentation_Bilarab_Almusallami.pdf', '-'], capture_output=True, text=True).stdout[:1500])
