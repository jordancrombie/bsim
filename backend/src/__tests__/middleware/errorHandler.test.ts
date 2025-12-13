import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../middleware/errorHandler';

describe('errorHandler', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockNext: NextFunction;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockRequest = {};
    mockResponse = {
      status: mockStatus,
      json: mockJson,
      statusCode: 200,
    };
    mockNext = jest.fn();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
  });

  it('should respond with 500 when statusCode is 200', () => {
    const error = new Error('Something went wrong');
    mockResponse.statusCode = 200;

    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith({
      error: 'Something went wrong',
    });
  });

  it('should use existing status code if not 200', () => {
    const error = new Error('Not found');
    mockResponse.statusCode = 404;

    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith({
      error: 'Not found',
    });
  });

  it('should log the error to console', () => {
    const error = new Error('Test error');

    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error:', error);
  });

  it('should return "Internal server error" when error has no message', () => {
    const error = new Error();
    error.message = '';

    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockJson).toHaveBeenCalledWith({
      error: 'Internal server error',
    });
  });

  it('should include stack trace in development mode', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const error = new Error('Dev error');
    error.stack = 'Error: Dev error\n    at Test.test';

    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockJson).toHaveBeenCalledWith({
      error: 'Dev error',
      stack: error.stack,
    });

    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should not include stack trace in production mode', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const error = new Error('Prod error');
    error.stack = 'Error: Prod error\n    at Test.test';

    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockJson).toHaveBeenCalledWith({
      error: 'Prod error',
    });

    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should not include stack trace in test mode', () => {
    // process.env.NODE_ENV is already 'test' from setup
    const error = new Error('Test error');
    error.stack = 'Error: Test error\n    at Test.test';

    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockJson).toHaveBeenCalledWith({
      error: 'Test error',
    });
  });

  it('should handle errors with special characters in message', () => {
    const error = new Error('<script>alert("xss")</script>');

    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockJson).toHaveBeenCalledWith({
      error: '<script>alert("xss")</script>',
    });
  });

  it('should use 400 status code when already set', () => {
    const error = new Error('Bad request');
    mockResponse.statusCode = 400;

    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({
      error: 'Bad request',
    });
  });

  it('should use 401 status code when already set', () => {
    const error = new Error('Unauthorized');
    mockResponse.statusCode = 401;

    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(mockJson).toHaveBeenCalledWith({
      error: 'Unauthorized',
    });
  });

  it('should use 403 status code when already set', () => {
    const error = new Error('Forbidden');
    mockResponse.statusCode = 403;

    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockStatus).toHaveBeenCalledWith(403);
    expect(mockJson).toHaveBeenCalledWith({
      error: 'Forbidden',
    });
  });
});
