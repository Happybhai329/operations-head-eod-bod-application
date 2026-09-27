import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { AuthRequest } from '../middleware/authMiddleware';

export class AuthController {
  public static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code } = req.body;
      const ipAddress = req.ip || req.socket.remoteAddress;

      const result = await AuthService.loginAdmin(code, ipAddress);

      if (!result.success) {
        res.status(401).json(result);
        return;
      }

      // Set secure HTTP-only cookie if appropriate
      if (result.token) {
        res.cookie('token', result.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  public static async me(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        user: req.user,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.clearCookie('token');
      res.status(200).json({ success: true, message: 'Logged out successfully.' });
    } catch (error) {
      next(error);
    }
  }
}
