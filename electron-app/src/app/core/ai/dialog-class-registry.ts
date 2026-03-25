/**
 * Registry of dialog classes that participate in the AI catalog.
 * Populated by static blocks in dialog components when their modules are loaded.
 * The dialog host's imports ensure all catalog dialogs are loaded at app bootstrap.
 * No hand-maintained list; the runtime set is "who registered."
 */
const classes: any[] = [];
const changeListeners: Array<() => void> = [];

export const AIDialogClassRegistry = {
  register(ctor: any): void {
    if (classes.indexOf(ctor) === -1) {
      classes.push(ctor);
      for (const cb of changeListeners) cb();
    }
  },

  getRegisteredClasses(): readonly any[] {
    return classes.slice();
  },

  onClassesChanged(cb: () => void): void {
    changeListeners.push(cb);
  },
};
