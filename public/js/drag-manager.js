export class DragManager {
  /**
   * @param {(id1: string, id2: string) => void} swapTerminals
   */
  constructor(swapTerminals) {
    this._swap = swapTerminals;
  }

  /** Attach drag-to-swap event listeners to a terminal pane and its header. */
  attach(pane, header, id) {
    header.draggable = true;
    header.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
      header.classList.add('dragging-source');
    });
    header.addEventListener('dragend', () => {
      header.classList.remove('dragging-source');
      pane.closest('#terminal-container')
        ?.querySelectorAll('.terminal-pane.drag-over')
        .forEach(el => el.classList.remove('drag-over'));
    });
    pane.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      pane.classList.add('drag-over');
    });
    pane.addEventListener('dragleave', (e) => {
      if (!pane.contains(e.relatedTarget)) {
        pane.classList.remove('drag-over');
      }
    });
    pane.addEventListener('drop', (e) => {
      e.preventDefault();
      pane.classList.remove('drag-over');
      const sourceId = e.dataTransfer.getData('text/plain');
      if (sourceId && sourceId !== id) {
        this._swap(sourceId, id);
      }
    });
  }
}
