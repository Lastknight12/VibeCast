export class Stack<Data> {
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

    this.items.pop();
  }

  peek() {
    if (this.items.length === 0) {
      return;
    }

    return this.items[this.items.length - 1];
  }

  delete(key: Data) {
    this.items = this.items.filter((item) => item !== key);
  }

  size() {
    return this.items.length;
  }
}
