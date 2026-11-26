import '@testing-library/jest-dom/vitest';

// jsdom does not implement scrollIntoView; list pickers call it to keep the highlighted row visible.
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
