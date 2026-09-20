/**
 * Numpad als DOM-laag. Bewust geen <input>: een tekst- of nummerveld opent op
 * iOS het systeemtoetsenbord en zoomt het scherm in.
 */

export interface NumpadOptions {
  /** Wordt aangeroepen met de ingetypte waarde, door OK of door autoSubmit. */
  onSubmit(value: number): void;
  /** Bij elke wijziging van de invoer. */
  onChange?(entry: string): void;
  /** Bij elke toetsaanslag, voor geluid en haptiek. */
  onKey?(): void;
  autoSubmit: boolean;
}

export interface Numpad {
  readonly entry: string;
  clear(): void;
  setEnabled(enabled: boolean): void;
  /** Aantal cijfers van het juiste antwoord; nodig voor autoSubmit. */
  setExpectedDigits(digits: number): void;
  /** Verwerkt een toetsaanslag van een fysiek toetsenbord. */
  handleKey(key: string): boolean;
  destroy(): void;
}

/** Cijfers in twee groepen van vijf: links 1 tot 5, rechts 6 tot 0. */
const LEFT_KEYS = ['1', '2', '3', '4', '5'] as const;
const RIGHT_KEYS = ['6', '7', '8', '9', '0'] as const;

/** Meer cijfers dan dit heeft geen enkel antwoord in het spel. */
const MAX_ENTRY = 3;

export function createNumpad(root: HTMLElement, options: NumpadOptions): Numpad {
  let entry = '';
  let enabled = true;
  let expectedDigits = 0;

  root.replaceChildren();

  const makeKey = (label: string, className: string, onPress: () => void): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.setAttribute('aria-label', label);
    // pointerdown in plaats van click: scheelt de vertraging van een tap.
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (!enabled) return;
      onPress();
    });
    return button;
  };

  const clearKey = makeKey('C', 'key key-clear', () => {
    options.onKey?.();
    setEntry('');
  });

  const leftGroup = document.createElement('div');
  leftGroup.className = 'numpad-group';
  const rightGroup = document.createElement('div');
  rightGroup.className = 'numpad-group';

  for (const digit of LEFT_KEYS) leftGroup.append(makeKey(digit, 'key', () => pressDigit(digit)));
  for (const digit of RIGHT_KEYS) rightGroup.append(makeKey(digit, 'key', () => pressDigit(digit)));

  const okKey = makeKey('OK', 'key key-ok', () => {
    options.onKey?.();
    submit();
  });

  root.append(clearKey, leftGroup, rightGroup, okKey);

  function setEntry(value: string): void {
    entry = value;
    options.onChange?.(entry);
  }

  function pressDigit(digit: string): void {
    if (entry.length >= MAX_ENTRY) return;
    options.onKey?.();
    // Een leidende nul levert nooit een geldig antwoord op, behalve "0" zelf.
    const next = entry === '0' ? digit : entry + digit;
    setEntry(next);
    if (options.autoSubmit && expectedDigits > 0 && next.length >= expectedDigits) submit();
  }

  function submit(): void {
    if (entry === '') return;
    const value = Number.parseInt(entry, 10);
    setEntry('');
    options.onSubmit(value);
  }

  const handleKey = (key: string): boolean => {
    if (!enabled) return false;
    if (key >= '0' && key <= '9') {
      pressDigit(key);
      return true;
    }
    if (key === 'Enter') {
      submit();
      return true;
    }
    if (key === 'Backspace' || key === 'Escape' || key === 'Delete') {
      setEntry(key === 'Backspace' ? entry.slice(0, -1) : '');
      return true;
    }
    return false;
  };

  return {
    get entry() {
      return entry;
    },
    clear: () => setEntry(''),
    setEnabled: (value: boolean) => {
      enabled = value;
      root.classList.toggle('disabled', !value);
    },
    setExpectedDigits: (digits: number) => {
      expectedDigits = digits;
    },
    handleKey,
    destroy: () => root.replaceChildren(),
  };
}
