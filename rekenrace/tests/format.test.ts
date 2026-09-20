import { describe, expect, it } from 'vitest';
import { formatPercent, formatSeconds, formatTime } from '../src/ui/hud.ts';
import { placeLabel } from '../src/ui/screens.ts';
import { shade } from '../src/render/sprites.ts';

describe('opmaak', () => {
  it('toont tijd als mm:ss', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(98)).toBe('01:38');
    expect(formatTime(192)).toBe('03:12');
    expect(formatTime(-5)).toBe('00:00');
  });

  it('toont reactietijd met een Nederlandse komma', () => {
    expect(formatSeconds(2.44)).toBe('2,4 s');
    expect(formatSeconds(6.14)).toBe('6,1 s');
    expect(formatSeconds(0)).toBe('0,0 s');
  });

  it('rondt accuraatheid af op hele procenten', () => {
    expect(formatPercent(24 / 27)).toBe('89%');
    expect(formatPercent(1)).toBe('100%');
  });

  it('geeft Nederlandse rangtelwoorden voor de eindpositie', () => {
    expect(placeLabel(1)).toBe('1e');
    expect(placeLabel(2)).toBe('2e');
    expect(placeLabel(4)).toBe('4e');
  });

  it('maakt een kleur lichter en donkerder', () => {
    expect(shade('#000000', 1)).toBe('rgb(255, 255, 255)');
    expect(shade('#ffffff', -1)).toBe('rgb(0, 0, 0)');
    expect(shade('#fff', 0)).toBe('rgb(255, 255, 255)');
  });
});
