declare module "*.csl" {
  const xml: string;
  export default xml;
}
declare module "*.xml" {
  const xml: string;
  export default xml;
}
declare module "citeproc" {
  const CSL: {
    Engine: new (sys: unknown, style: string, locale: string) => any;
  };
  export default CSL;
}
