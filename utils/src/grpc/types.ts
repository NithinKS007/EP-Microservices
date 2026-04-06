import * as grpc from "@grpc/grpc-js";

export type ServerUnaryCall<Req, Res> = grpc.ServerUnaryCall<Req, Res>;
export type SendUnaryData<Res> = grpc.sendUnaryData<Res>;
