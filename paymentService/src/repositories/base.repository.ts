import { PrismaAdapter } from "../../../utils/src/IBase.repository";

export class BaseRepository<TModel, TCreate, TUpdate, TWhere, TFindManyArgs> {
  constructor(protected adapter: PrismaAdapter<TModel, TCreate, TUpdate, TWhere, TFindManyArgs>) {}

  create(data: TCreate) {
    return this.adapter.create(data);
  }

  findById(id: string) {
    return this.adapter.findById(id);
  }

  findOne(where: TWhere) {
    return this.adapter.findOne(where);
  }

  findMany(args?: TFindManyArgs) {
    return this.adapter.findMany(args);
  }

  update(where: TWhere, data: TUpdate) {
    return this.adapter.update(where, data);
  }

  delete(where: TWhere) {
    return this.adapter.delete(where);
  }

  deleteMany(where: TWhere) {
    return this.adapter.deleteMany(where);
  }

  count(where: TWhere) {
    return this.adapter.count(where);
  }
}
