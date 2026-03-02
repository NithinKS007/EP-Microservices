import { Model, FilterQuery, UpdateQuery } from "mongoose";

/**
 * Generic interface defining CRUD operations for any database adapter.
 * TModel: The type returned by the database (e.g., Prisma model or Mongoose document)
 * TCreate: The type used to create a new record
 * TUpdate: The type used to update a record
 * TWhere: The type for query filters
 */

export interface DatabaseAdapter<TModel, TCreate, TUpdate, TWhere, TFindManyArgs> {
  create(data: TCreate): Promise<TModel>;

  findById(id: string): Promise<TModel | null>;
  findOne(where: TWhere): Promise<TModel | null>;
  findMany(args?: TFindManyArgs): Promise<TModel[]>;

  update(where: TWhere, data: TUpdate): Promise<TModel | null>;
  delete(where: TWhere): Promise<TModel | null>;
  deleteMany(where: TWhere): Promise<unknown>;

  count(where: TWhere): Promise<number>;
}

/**
 * Adapter for Prisma ORM to implement generic DatabaseAdapter.
 * Wraps Prisma client methods to conform to a unified interface.
 * Provides error-safe update/delete (returns null if fails) to prevent runtime crashes.
 */

export class PrismaAdapter<
  TModel,
  TCreate,
  TUpdate,
  TWhere,
  TFindManyArgs,
> implements DatabaseAdapter<TModel, TCreate, TUpdate, TWhere, TFindManyArgs> {
  constructor(
    private readonly delegate: {
      create(args: { data: TCreate }): Promise<TModel>;
      findUnique(args: { where: { id: string } }): Promise<TModel | null>;
      findFirst(args: { where: TWhere }): Promise<TModel | null>;
      findMany(args?: TFindManyArgs): Promise<TModel[]>;
      update(args: { where: TWhere; data: TUpdate }): Promise<TModel>;
      delete(args: { where: TWhere }): Promise<TModel>;
      deleteMany(args: { where: TWhere }): Promise<unknown>;
      count(args: { where: TWhere }): Promise<number>;
      updateMany(args: { where: TWhere; data: TUpdate }): Promise<unknown>;
    },
  ) {}

  async create(data: TCreate) {
    return await this.delegate.create({ data });
  }

  async findById(id: string) {
    return await this.delegate.findUnique({ where: { id } });
  }

  async findOne(where: TWhere) {
    return await this.delegate.findFirst({ where });
  }

  async findMany(args?: TFindManyArgs) {
    return this.delegate.findMany(args);
  }

  async updateMany(where: TWhere, data: TUpdate) {
    try {
      return await this.delegate.updateMany({ where, data });
    } catch {
      return null;
    }
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

  async deleteMany(where: TWhere) {
    return await this.delegate.deleteMany({ where });
  }

  async count(where: TWhere) {
    return await this.delegate.count({ where });
  }
}

/**
 * Adapter for Mongoose to implement generic DatabaseAdapter.
 * Wraps Mongoose model methods to conform to a unified interface.
 * Supports lean queries by default for better performance.
 */

export type MongooseFindManyArgs<TWhere> = {
  where?: TWhere;
  skip?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
};

export class MongooseAdapter<
  TModel,
  TCreate,
  TUpdate extends UpdateQuery<TModel>,
  TWhere extends FilterQuery<TModel>,
> implements DatabaseAdapter<TModel, TCreate, TUpdate, TWhere, MongooseFindManyArgs<TWhere>> {
  constructor(private readonly model: Model<TModel>) {}

  async create(data: TCreate): Promise<TModel> {
    return await this.model.create(data);
  }

  async findById(id: string): Promise<TModel | null> {
    return await this.model.findById(id);
  }

  async findOne(where: TWhere): Promise<TModel | null> {
    return await this.model.findOne(where);
  }

  async findMany(args?: MongooseFindManyArgs<TWhere>) {
    const query = this.model.find(args?.where ?? {});

    if (args?.skip) query.skip(args.skip);
    if (args?.limit) query.limit(args.limit);
    if (args?.sort) query.sort(args.sort);

    return await query.exec();
  }

  async update(where: TWhere, data: TUpdate) {
    return this.model.findOneAndUpdate(where, data, { new: true }).exec();
  }

  async delete(where: TWhere) {
    return this.model.findOneAndDelete(where).exec();
  }

  async deleteMany(where: TWhere): Promise<unknown> {
    return await this.model.deleteMany(where).exec();
  }

  async count(where: TWhere): Promise<number> {
    return await this.model.countDocuments(where).exec();
  }
}
