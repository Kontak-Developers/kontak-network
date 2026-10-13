// wrangler modül türleri: .wasm → CompiledWasm (WebAssembly.Module), .ttf → Data (ArrayBuffer)
declare module '*.wasm' {
  const m: WebAssembly.Module;
  export default m;
}
declare module '*.ttf' {
  const b: ArrayBuffer;
  export default b;
}
