declare module "jest-mock" {
  interface MockInstance<T extends FunctionLike = UnknownFunction> {
    mockResolvedValue(value: any): this;
    mockResolvedValueOnce(value: any): this;
    mockRejectedValue(value: any): this;
    mockRejectedValueOnce(value: any): this;
  }
}
