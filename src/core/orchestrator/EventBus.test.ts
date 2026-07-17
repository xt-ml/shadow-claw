import { EventBus } from "./EventBus.js";

describe("EventBus", () => {
  it("delivers event data to a registered listener", () => {
    const bus = new EventBus();
    const received: any[] = [];

    bus.on("test", (data: any) => received.push(data));
    bus.emit("test", { value: 42 });

    expect(received).toEqual([{ value: 42 }]);
  });

  it("off removes a specific listener", () => {
    const bus = new EventBus();
    const received: any[] = [];
    const handler = (data: any) => received.push(data);

    bus.on("test", handler);
    bus.off("test", handler);
    bus.emit("test", "hello");

    expect(received).toHaveLength(0);
  });

  it("emit with no registered listeners is a no-op", () => {
    const bus = new EventBus();

    expect(() => bus.emit("nothing", {})).not.toThrow();
  });

  it("multiple listeners on the same event all receive the data", () => {
    const bus = new EventBus();
    const a: any[] = [];
    const b: any[] = [];

    bus.on("multi", (d: any) => a.push(d));
    bus.on("multi", (d: any) => b.push(d));
    bus.emit("multi", 99);

    expect(a).toEqual([99]);
    expect(b).toEqual([99]);
  });

  it("listeners on different events are independent", () => {
    const bus = new EventBus();
    const received: any[] = [];

    bus.on("a", (d: any) => received.push(d));
    bus.emit("b", "should not appear");

    expect(received).toHaveLength(0);
  });

  it("removing one listener does not affect other listeners on the same event", () => {
    const bus = new EventBus();
    const received: any[] = [];
    const remove = () => {};
    const keep = (d: any) => received.push(d);

    bus.on("ev", remove);
    bus.on("ev", keep);
    bus.off("ev", remove);
    bus.emit("ev", "hello");

    expect(received).toEqual(["hello"]);
  });
});
