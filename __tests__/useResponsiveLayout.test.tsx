import { isTabletSize, getOrientation, tokensFor, TABLET_MIN_WIDTH } from '../src/hooks/useResponsiveLayout';

describe('isTabletSize', () => {
  it('treats a phone as non-tablet regardless of width', () => {
    expect(isTabletSize(932, false)).toBe(false);
  });

  it('treats wide phone landscape as non-tablet because it is not an iPad', () => {
    expect(isTabletSize(932, false)).toBe(false);
  });

  it('detects an iPad mini portrait (744pt) as a tablet', () => {
    expect(isTabletSize(744, true)).toBe(true);
  });

  it('detects an iPad Pro landscape as a tablet', () => {
    expect(isTabletSize(1366, true)).toBe(true);
  });

  it('falls back to compact on narrow iPad split view widths', () => {
    const narrow = TABLET_MIN_WIDTH - 200;
    expect(isTabletSize(narrow, true)).toBe(false);
  });

  it('uses the width threshold as the boundary', () => {
    expect(isTabletSize(TABLET_MIN_WIDTH, true)).toBe(true);
    expect(isTabletSize(TABLET_MIN_WIDTH - 1, true)).toBe(false);
  });
});

describe('getOrientation', () => {
  it('returns portrait when height exceeds width', () => {
    expect(getOrientation(390, 844)).toBe('portrait');
  });

  it('returns landscape when width exceeds height', () => {
    expect(getOrientation(1133, 744)).toBe('landscape');
  });
});

describe('tokensFor', () => {
  it('returns phone tokens for compact layouts', () => {
    const tokens = tokensFor(false);
    expect(tokens.touchTarget).toBe(44);
    expect(tokens.rowHeight).toBe(56);
    expect(tokens.sidebarWidth).toBe(0);
    expect(tokens.spacing.xl).toBe(24);
  });

  it('returns scaled tablet tokens for regular layouts', () => {
    const tokens = tokensFor(true);
    expect(tokens.touchTarget).toBe(48);
    expect(tokens.rowHeight).toBe(64);
    expect(tokens.sidebarWidth).toBe(240);
    expect(tokens.contentMaxWidth).toBe(980);
    expect(tokens.spacing.xl).toBe(32);
  });
});