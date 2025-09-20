import { getDatabase } from '../lib/mongodb';
    import { hashPassword } from '../lib/auth';

    export async function POST(request: Request) {
      try {
        const { token, password } = await request.json();

        if (!token || !password) {
          return Response.json(
            { error: 'Token and password are required' },
            { status: 400 }
          );
        }

        if (password.length < 6) {
          return Response.json(
            { error: 'Password must be at least 6 characters' },
            { status: 400 }
          );
        }

        const db = await getDatabase();
        
        // Find user by reset token
        const user = await db.collection('users').findOne({
          resetToken: token,
          resetTokenExpiry: { $gt: new Date() },
        });

        if (!user) {
          return Response.json(
            { error: 'Invalid or expired reset token' },
            { status: 400 }
          );
        }

        // Hash new password
        const hashedPassword = await hashPassword(password);

        // Update user password and clear reset token
        await db.collection('users').updateOne(
          { _id: user._id },
          {
            $set: {
              password: hashedPassword,
              updatedAt: new Date(),
            },
            $unset: {
              resetToken: '',
              resetTokenExpiry: '',
            },
          }
        );

        return Response.json({
          message: 'Password reset successfully',
        });
      } catch (error) {
        console.error('Reset password error:', error);
        return Response.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    }