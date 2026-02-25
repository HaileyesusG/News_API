import { Response } from 'express';

interface BaseResponse {
  Success: boolean;
  Message: string;
  Object: object | null;
  Errors: string[] | null;
}

interface PaginatedResponse extends Omit<BaseResponse, 'Object'> {
  Object: object[];
  PageNumber: number;
  PageSize: number;
  TotalSize: number;
}

export const sendSuccess = (
  res: Response,
  message: string,
  data: object | null = null,
  statusCode: number = 200
): Response => {
  const response: BaseResponse = {
    Success: true,
    Message: message,
    Object: data,
    Errors: null,
  };
  return res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  statusCode: number,
  message: string,
  errors: string[] = []
): Response => {
  const response: BaseResponse = {
    Success: false,
    Message: message,
    Object: null,
    Errors: errors.length > 0 ? errors : [message],
  };
  return res.status(statusCode).json(response);
};

export const sendPaginated = (
  res: Response,
  message: string,
  items: object[],
  pageNumber: number,
  pageSize: number,
  totalSize: number
): Response => {
  const response: PaginatedResponse = {
    Success: true,
    Message: message,
    Object: items,
    PageNumber: pageNumber,
    PageSize: pageSize,
    TotalSize: totalSize,
    Errors: null,
  };
  return res.status(200).json(response);
};
