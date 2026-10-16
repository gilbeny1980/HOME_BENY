#!/usr/bin/env python3
"""Single source of truth for the ringtones.
Renders every tone to a WAV for the Android app (res/raw) and rewrites the TONES table in app.js,
so the in-page preview and the native alarm sound the same."""
import json, re, sys, wave
import numpy as np

SR = 32000
BELL = [[1, 1], [2.76, .28], [5.4, .1]]
GLASS = [[1, 1], [2, .28], [3, .1], [4.1, .04]]
# key: (hebrew name, notes [freq, start, dur, glide-to-freq?], wave, harmonics, gain, echo)
TONES = {
    'msg':      ('הודעה חדשה ✨',   [[659, 0, .55], [988, .11, .6], [1319, .24, 1.1]], 'sine', GLASS, .34, True),
    'bubble':   ('בועה 🫧',         [[520, 0, .16, 1040], [700, .14, .18, 1400], [880, .3, .3, 1760]], 'sine', [[1, 1], [2, .15]], .4, False),
    'drop':     ('טיפה 💧',         [[1760, 0, .45, 1100], [1320, .32, .5, 880]], 'sine', [[1, 1], [2, .2]], .36, True),
    'bell':     ('פעמון רך 🔔',     [[988, 0, 1.2], [1480, .2, 1.4]], 'sine', BELL, .3, True),
    'doorbell': ('פעמון דלת 🚪',    [[659, 0, .9], [523, .45, 1.4]], 'sine', [[1, 1], [2, .3], [3, .1]], .36, True),
    'sparkle':  ('נצנוץ ✨',        [[1319, 0, .35], [1568, .07, .35], [1976, .14, .35], [2349, .21, .35], [2637, .28, .8]], 'sine', [[1, 1], [2, .2]], .26, True),
    'harp':     ('נבל 🎶',          [[523, 0, .9], [659, .09, .9], [784, .18, .9], [1046, .27, .9], [1318, .36, 1.2]], 'triangle', [[1, 1], [2, .35], [3, .15]], .3, False),
    'marimba':  ('מרימבה 🥁',       [[784, 0, .3], [988, .14, .3], [1318, .28, .3], [1568, .42, .55]], 'sine', [[1, 1], [4, .22]], .4, False),
}

def wave_fn(kind, ph):
    return np.sin(ph) if kind == 'sine' else (2 / np.pi) * np.arcsin(np.sin(ph))

def render(notes, kind, harm, gain, echo):
    total = max(n[1] + n[2] for n in notes) + (1.6 if echo else .6)
    out = np.zeros(int(total * SR) + SR)
    for n in notes:
        f, st, dur = n[0], n[1], n[2]
        f2 = n[3] if len(n) > 3 else None
        t = np.arange(int((dur + .05) * SR)) / SR
        if f2:
            fr = f * (f2 / f) ** np.clip(t / (dur * .7), 0, 1)
        else:
            fr = np.full_like(t, f)
        ph = 2 * np.pi * np.cumsum(fr) / SR
        att = .015
        env = np.where(t < att, t / att, np.exp(-np.log(1000) * np.clip(t - att, 0, None) / max(dur - att, .01)))
        env[t > dur] = 0
        for mult, amp in harm:
            out[int(st * SR):int(st * SR) + len(t)] += wave_fn(kind, ph * mult) * env * gain * amp / (1.2 if mult > 1 else 1)
    if echo:
        e = np.zeros_like(out)
        for k in range(1, 7):
            d = int(.22 * k * SR)
            e[d:] += (.32 ** (k - 1)) * out[:len(out) - d]
        out = out + .5 * e
    out = out[:int((total + 1.0) * SR)]  # trailing silence so a looping player breathes between rings
    out = out / max(np.abs(out).max(), 1e-6) * .95
    return out

def js_table():
    # the user's own recording (served from /sounds, bundled as res/raw/tone_sms.mp3)
    rows = ["  sms:['הצליל שלי – SMS 💬',[],'sine',[[1,1]],1,false,'/sounds/sms.mp3'],"]
    for k, (name, notes, kind, harm, gain, echo) in TONES.items():
        rows.append("  %s:[%s,%s,'%s',%s,%s,%s]," % (k, json.dumps(name, ensure_ascii=False), json.dumps(notes), kind, json.dumps(harm), gain, 'true' if echo else 'false'))
    rows.append("  silent:['שקט (בלי צליל)',[],'sine',[[1,1]],0]")
    return "const TONES={\n" + "\n".join(rows) + "\n};"

if __name__ == '__main__':
    for k, (name, notes, kind, harm, gain, echo) in TONES.items():
        pcm = (render(notes, kind, harm, gain, echo) * 32767).astype('<i2')
        with wave.open('android/app/src/main/res/raw/tone_%s.wav' % k, 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    src = open('app.js').read()
    new = re.sub(r"const TONES=\{.*?\n\};", lambda m: js_table(), src, count=1, flags=re.S)
    assert new != src or 'bubble' in src
    open('app.js', 'w').write(new)
    print('wavs:', ', '.join(TONES), '| app.js updated')
