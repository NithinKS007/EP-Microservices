import { PrismaAdapter } from "../../../utils/src/IBase.repository";

export class BaseRepository<TModel, TCreate, TUpdate, TWhere> {
  constructor(protected adapter: PrismaAdapter<TModel, TCreate, TUpdate, TWhere>) {}

  create(data: TCreate) {
    return this.adapter.create(data);
  }

  findById(id: string) {
    return this.adapter.findById(id);
  }

  update(where: TWhere, data: TUpdate) {
    return this.adapter.update(where, data);
  }

  delete(where: TWhere) {
    return this.adapter.delete(where);
  }
}
