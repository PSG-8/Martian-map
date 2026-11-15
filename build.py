T="Want to build your own radar? Let's do it in four steps! Step one: the ultrasonic sensor. It sends sound, like a bat, and listens for the echo. Step two: put it on a servo, so it sweeps left and right. Step three: a buzzer beeps when something gets close. Step four: traffic LEDs. Green is safe, yellow is careful, red means stop! Upload the code to your Arduino, and your radar comes alive! Ready to build it with us?"
S=[(0.256,0.469),(0.512,0.597),(0.64,0.768),(0.853,0.939),(0.981,1.0667),(1.152,1.451),(1.877,2.133),(2.176,2.304),(2.347,2.389),(2.432,2.4747),(2.517,2.7307),(2.773,3.029),(3.925,4.181),(4.267,4.437),(4.736,4.864),(4.907,5.461),(5.547,5.888),(6.357,6.528),(6.571,6.784),(6.955,7.211),(7.723,7.893),(7.936,8.021),(8.064,8.235),(8.619,8.789),(8.832,9.088),(9.173,9.344),(9.387,9.429),(9.472,9.6),(10.325,10.5387),(10.667,10.837),(11.349,11.52),(11.563,11.605),(11.648,11.733),(11.776,11.8187),(11.861,12.203),(12.501,12.672),(12.715,12.757),(12.8,13.141),(13.227,13.44),(13.611,13.696),(13.739,13.909),(14.233,14.489),(14.574,14.788),(15.172,15.47),(15.513,15.8118),(15.897,16.153),(16.281,16.409),(16.452,16.622),(16.836,16.9638),(17.092,17.305),(17.902,18.1158),(18.201,18.414),(19.012,19.3958),(19.481,19.908),(20.462,20.718),(20.804,20.889),(20.932,21.145),(21.529,21.785),(21.956,22.0838),(22.126,22.34),(22.852,23.193),(23.321,23.4918),(23.705,24.004),(24.516,24.942),(24.985,25.07),(25.113,25.2838),(25.369,25.497),(25.54,25.625),(25.668,25.966),(26.35,26.5638),(26.606,26.734),(26.777,27.161),(27.204,27.3318),(27.502,27.716),(28.313,28.441),(28.569,28.654),(28.697,28.825),(28.868,28.91),(28.996,29.081),(29.124,29.209)]
toks=T.split(' ')
assert len(toks)==len(S)==80,(len(toks),len(S))
import json,base64
words=[{"t":t,"s":a,"e":b} for t,(a,b) in zip(toks,S)]
json.dump(words,open('words.json','w'))
src=open('anim.src.html').read()
def ff(name,path,w):
    b=base64.b64encode(open(path,'rb').read()).decode()
    return "@font-face{font-family:'%s';src:url(data:font/ttf;base64,%s) format('truetype');font-weight:%s;}\n"%(name,b,w)
G='fonts/'
fonts=ff('Pop',G+'Poppins-Bold.ttf',700)+ff('Pop',G+'Poppins-Medium.ttf',500)+ff('Mono','fonts/DejaVuSansMono-Bold.ttf',700)
out=src.replace('/*FONTS*/',fonts).replace('/*WORDS*/[]',json.dumps(words))
open('anim.html','w').write(out)
print(len(out))
