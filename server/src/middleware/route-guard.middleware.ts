export type RouteAccessLevel = 'public' | 'authenticated' | 'USER' | 'ADMIN';

export interface RouteDeclaration {
  method: string;
  path: string;
  access?: RouteAccessLevel;
}

export class RouteRegistry {
  private static registeredRoutes: RouteDeclaration[] = [];

  static register(method: string, path: string, access?: RouteAccessLevel): void {
    if (!access) {
      throw new Error(
        `[NFR-02 Violation] Route ${method.toUpperCase()} ${path} registered without declared access guard.`
      );
    }
    this.registeredRoutes.push({ method: method.toUpperCase(), path, access });
  }

  static getRoutes(): RouteDeclaration[] {
    return [...this.registeredRoutes];
  }

  static clear(): void {
    this.registeredRoutes = [];
  }
}

