// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNumpad } from '../src/ui/numpad.ts';

function setup(overrides: Partial<Parameters<typeof createNumpad>[1]> = {}) {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const onSubmit = vi.fn();
  const onChange = vi.fn();
  const numpad = createNumpad(root, { autoSubmit: false, onSubmit, onChange, ...overrides });
  return { root, numpad, onSubmit, onChange };
}

function tap(root: HTMLElement, label: string): void {
  const button = [...root.querySelectorAll('button')].find((b) => b.textContent === label);
  if (button === undefined) throw new Error(`toets niet gevonden: ${label}`);
  button.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
}

describe('numpad', () => {
  beforeEach(() => document.body.replaceChildren());

  it('gebruikt nooit een invoerveld, alleen knoppen', () => {
    const { root } = setup();
    expect(root.querySelectorAll('input')).toHaveLength(0);
    expect(root.querySelectorAll('textarea')).toHaveLength(0);
    expect(root.querySelectorAll('button')).toHaveLength(12);
  });

  it('zet de cijfers in twee rijen van vijf, met C en OK eronder', () => {
    const { root } = setup();
    const digits = [...root.querySelectorAll('.key-digit')].map((key) => key.textContent);
    // De twee rijen van het raster vormen de twee groepen van vijf.
    expect(digits.slice(0, 5)).toEqual(['1', '2', '3', '4', '5']);
    expect(digits.slice(5)).toEqual(['6', '7', '8', '9', '0']);

    // C en OK staan als laatste in de DOM en dus onderin het raster.
    const children = [...root.children];
    expect(children.at(-2)?.textContent).toBe('C');
    expect(children.at(-1)?.textContent).toBe('OK');
    expect(root.querySelector('.key-clear')).not.toBeNull();
    expect(root.querySelector('.key-ok')).not.toBeNull();
  });

  it('bouwt een antwoord op en bevestigt met OK', () => {
    const { root, numpad, onSubmit } = setup();
    tap(root, '5');
    tap(root, '6');
    expect(numpad.entry).toBe('56');
    tap(root, 'OK');
    expect(onSubmit).toHaveBeenCalledWith(56);
    expect(numpad.entry).toBe('');
  });

  it('wist de invoer met C', () => {
    const { root, numpad } = setup();
    tap(root, '7');
    tap(root, '7');
    tap(root, 'C');
    expect(numpad.entry).toBe('');
  });

  it('doet niets bij OK zonder invoer', () => {
    const { root, onSubmit } = setup();
    tap(root, 'OK');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('bevestigt automatisch zodra het aantal cijfers klopt', () => {
    const { root, numpad, onSubmit } = setup({ autoSubmit: true });
    numpad.setExpectedDigits(2);
    tap(root, '4');
    expect(onSubmit).not.toHaveBeenCalled();
    tap(root, '2');
    expect(onSubmit).toHaveBeenCalledWith(42);
  });

  it('laat OK werken als fallback terwijl autoSubmit aanstaat', () => {
    const { root, onSubmit } = setup({ autoSubmit: true });
    // Zonder bekend aantal cijfers valt autoSubmit stil en blijft OK over.
    tap(root, '9');
    expect(onSubmit).not.toHaveBeenCalled();
    tap(root, 'OK');
    expect(onSubmit).toHaveBeenCalledWith(9);
  });

  it('bevestigt niet automatisch als autoSubmit uitstaat', () => {
    const { root, onSubmit } = setup({ autoSubmit: false });
    tap(root, '1');
    tap(root, '2');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('negeert toetsen als de numpad uitstaat', () => {
    const { root, numpad, onSubmit } = setup();
    numpad.setEnabled(false);
    tap(root, '3');
    tap(root, 'OK');
    expect(numpad.entry).toBe('');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(root.classList.contains('disabled')).toBe(true);
  });

  it('begrenst de invoer op drie cijfers', () => {
    const { root, numpad } = setup();
    for (const digit of ['1', '2', '3', '4', '5']) tap(root, digit);
    expect(numpad.entry).toBe('123');
  });

  it('vervangt een losse nul in plaats van er een leidende nul van te maken', () => {
    const { root, numpad } = setup();
    tap(root, '0');
    tap(root, '7');
    expect(numpad.entry).toBe('7');
  });

  it('meldt elke wijziging van de invoer', () => {
    const { root, onChange } = setup();
    tap(root, '8');
    expect(onChange).toHaveBeenCalledWith('8');
  });

  it('accepteert ook een fysiek toetsenbord', () => {
    const { numpad, onSubmit } = setup();
    expect(numpad.handleKey('4')).toBe(true);
    expect(numpad.handleKey('2')).toBe(true);
    expect(numpad.handleKey('Backspace')).toBe(true);
    expect(numpad.entry).toBe('4');
    expect(numpad.handleKey('Enter')).toBe(true);
    expect(onSubmit).toHaveBeenCalledWith(4);
    expect(numpad.handleKey('a')).toBe(false);
  });
});
