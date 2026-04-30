import { FilesUiStore } from "./files-ui.js";

describe("FilesUiStore", () => {
  it("tracks drag state", () => {
    const store = new FilesUiStore();

    expect(store.isDragActive).toBe(false);

    store.setDragActive(true);
    expect(store.isDragActive).toBe(true);

    store.setDragActive(false);
    expect(store.isDragActive).toBe(false);
  });

  it("tracks upload progress lifecycle", () => {
    const store = new FilesUiStore();

    store.startUpload(3);
    expect(store.uploadTotal).toBe(3);
    expect(store.uploadCompleted).toBe(0);

    store.setUploadCompleted(2);
    expect(store.uploadCompleted).toBe(2);

    store.resetUpload();
    expect(store.uploadTotal).toBe(0);
    expect(store.uploadCompleted).toBe(0);
  });
});
