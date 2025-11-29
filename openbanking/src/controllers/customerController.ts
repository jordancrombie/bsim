import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

export class CustomerController {
  constructor(private prisma: PrismaClient) {}

  // GET /customers/current - Get current customer info
  async getCurrentCustomer(req: Request, res: Response) {
    try {
      const userId = req.token?.sub;

      if (!userId) {
        return res.status(401).json({
          error: 'unauthorized',
          error_description: 'Invalid token',
        });
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          address: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          dateOfBirth: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          error: 'not_found',
          error_description: 'Customer not found',
        });
      }

      // Check which scopes the token has
      const scopes = req.token?.scopes || [];

      // Build response based on scopes
      const customer: Record<string, any> = {
        customerId: user.id,
      };

      // Profile scope: name and DOB
      if (scopes.includes('profile')) {
        customer.name = {
          first: user.firstName,
          last: user.lastName,
          full: `${user.firstName} ${user.lastName}`,
        };
        if (user.dateOfBirth) {
          customer.dateOfBirth = user.dateOfBirth.toISOString().split('T')[0];
        }
      }

      // Email scope
      if (scopes.includes('email')) {
        customer.email = user.email;
      }

      // Contact info scope
      if (scopes.includes('fdx:customercontact:read')) {
        if (user.phone) {
          customer.phone = user.phone;
        }
        if (user.address) {
          customer.addresses = [
            {
              type: 'HOME',
              line1: user.address,
              city: user.city,
              state: user.state,
              postalCode: user.postalCode,
              country: user.country,
            },
          ];
        }
      }

      res.json({ customer });
    } catch (error) {
      console.error('Error fetching customer:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Failed to fetch customer information',
      });
    }
  }
}
