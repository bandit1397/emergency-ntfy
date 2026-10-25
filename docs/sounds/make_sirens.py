"""ntfy 알람용 사이렌 소리를 만든다 (직접 합성, 저작권 없음).

    python make_sirens.py <출력 폴더>
    ffmpeg -i siren_wail.wav -c:a libvorbis -q:a 5 -metadata title="Emergency Siren (wail)" siren_wail.ogg
    ffmpeg -i siren_yelp.wav -c:a libvorbis -q:a 5 -metadata title="Emergency Bell (fast)" siren_yelp.ogg
"""
import numpy as np, wave, sys
sr = 44100
def tone(freq):
    # 위상 누적으로 주파수가 바뀌어도 끊김 없이, 홀수 배음을 더해 날카로운 사이렌 음색
    ph = 2*np.pi*np.cumsum(freq)/sr
    return sum(np.sin(k*ph)/k for k in (1,3,5,7)) / 1.7
def save(name, x):
    x = np.clip(x, -1, 1)
    fade = int(sr*0.01); x[:fade] *= np.linspace(0,1,fade); x[-fade:] *= np.linspace(1,0,fade)
    with wave.open(name, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((x*0.9*32767).astype(np.int16).tobytes())
out = sys.argv[1]
# 1) 웨일: 650 → 1450 Hz 를 천천히 오르내림 (구급차·민방위 느낌), 3초 × 2
t = np.arange(int(sr*6))/sr
f = 1050 - 400*np.cos(2*np.pi*t/3)
save(out + '/siren_wail.wav', tone(f))
# 2) 비상벨: 빠른 고저 반복 (yelp), 0.35초 주기
t = np.arange(int(sr*4.2))/sr
f = 1100 - 450*np.cos(2*np.pi*t/0.35)
save(out + '/siren_yelp.wav', tone(f))
