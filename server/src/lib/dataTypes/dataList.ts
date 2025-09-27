export class DataList<Data> {
  items: Data[] = [];

  constructor(initItems?: Data[]) {
    if (initItems) {
      this.items = initItems;
    }
  }

  add(item: Data) {
    this.items.push(item);
  }

  pop() {
    if (this.items.length === 0) {
      return;
    }

    return this.items.pop();
  }

  clear() {
    this.items = [];
  }

  peek() {
    if (this.items.length === 0) {
      return;
    }

    return this.items[this.items.length - 1];
  }

  size() {
    return this.items.length;
  }
}
