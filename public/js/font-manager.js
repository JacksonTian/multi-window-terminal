const STORAGE_KEY_SIZE = 'mwt-font-size';
const STORAGE_KEY_FAMILY = 'mwt-font-family';

const DEFAULT_FONT_SIZE = 12;
const DEFAULT_FONT_FAMILY = "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Menlo', monospace";

export class FontManager {
  constructor() {
    this._listeners = [];
    this._fontSize = parseInt(localStorage.getItem(STORAGE_KEY_SIZE), 10) || DEFAULT_FONT_SIZE;
    this._fontFamily = localStorage.getItem(STORAGE_KEY_FAMILY) || DEFAULT_FONT_FAMILY;
  }

  get fontSize() {
    return this._fontSize;
  }

  get fontFamily() {
    return this._fontFamily;
  }

  setFontSize(size) {
    this._fontSize = size;
    localStorage.setItem(STORAGE_KEY_SIZE, size);
    this._notify();
  }

  setFontFamily(family) {
    this._fontFamily = family;
    localStorage.setItem(STORAGE_KEY_FAMILY, family);
    this._notify();
  }

  onChange(callback) {
    this._listeners.push(callback);
  }

  _notify() {
    for (const cb of this._listeners) {
      cb({ fontSize: this._fontSize, fontFamily: this._fontFamily });
    }
  }
}
