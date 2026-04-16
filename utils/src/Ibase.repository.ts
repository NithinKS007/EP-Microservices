/**
 * Generic interface defining CRUD operations for any database adapter.
 * TModel: The type returned by the database (e.g., Prisma model)
 * TCreate: The type used to create a new record
 * TUpdate: The type used to update a record
 * TWhere: The type for query filters
 */

export interface DatabaseAdapter<TModel, TCreate, TUpdate, TWhere> {
  create(data: TCreate): Promise<TModel>;
  findById(id: string): Promise<TModel | null>;
  update(where: TWhere, data: TUpdate): Promise<TModel | null>;
  delete(where: TWhere): Promise<TModel | null>;
}

/**
 * Adapter for Prisma ORM to implement generic DatabaseAdapter.
 * Wraps Prisma client methods to conform to a unified interface.
 * Provides error-safe update/delete (returns null if fails) to prevent runtime crashes.
 */

export class PrismaAdapter<TModel, TCreate, TUpdate, TWhere> implements DatabaseAdapter<
  TModel,
  TCreate,
  TUpdate,
  TWhere
> {
  constructor(
    private readonly delegate: {
      create(args: { data: TCreate }): Promise<TModel>;
      findUnique(args: { where: { id: string } }): Promise<TModel | null>;
      update(args: { where: TWhere; data: TUpdate }): Promise<TModel>;
      delete(args: { where: TWhere }): Promise<TModel>;
    },
  ) {}

  async create(data: TCreate) {
    return await this.delegate.create({ data });
  }

  async findById(id: string) {
    return await this.delegate.findUnique({ where: { id } });
  }

  async update(where: TWhere, data: TUpdate) {
    try {
      return await this.delegate.update({ where, data });
    } catch {
      return null;
    }
  }

  async delete(where: TWhere) {
    try {
      return await this.delegate.delete({ where });
    } catch {
      return null;
    }
  }
}
