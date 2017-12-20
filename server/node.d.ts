// HINT "URL" is missing in @types/node/index.d.ts but needed by "nodemailer"

declare module "url" {
  export interface URLObject {
      href?: string;
      protocol?: string;
      slashes?: boolean;
      host?: string;
      auth?: string;
      hostname?: string;
      port?: string | number;
      pathname?: string;
      search?: string;
      path?: string;
      query?: string | { [key: string]: any; };
      hash?: string;
  }

  export interface URL extends URLObject {
      port?: string;
      query?: any;
  }

  export function parse(urlStr: string, parseQueryString?: boolean, slashesDenoteHost?: boolean): URL;
  export function format(urlObject: URLObject | string): string;
  export function resolve(from: string, to: string): string;
}
