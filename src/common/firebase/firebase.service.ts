import {
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getStorage, Storage } from 'firebase-admin/storage';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private firebaseApp: App;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    if (!projectId) {
      throw new Error(
        'Critical Configuration Missing: FIREBASE_PROJECT_ID is not defined in the environment variables.',
      );
    }

    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
    const storageBucket =
      this.configService.get<string>('FIREBASE_STORAGE_BUCKET') ||
      'bizzdeal.firebasestorage.app';

    const apps = getApps();
    if (apps.length > 0 && apps[0]) {
      this.firebaseApp = apps[0];
      return;
    }

    if (clientEmail && privateKey) {
      const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
      this.firebaseApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: formattedPrivateKey,
        }),
        projectId,
        storageBucket,
      });
    } else {
      this.firebaseApp = initializeApp({
        projectId,
        storageBucket,
      });
    }

    this.logger.log(
      `Firebase Admin SDK initialized successfully for project: ${projectId}`,
    );
    if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
      this.logger.log(
        `Firebase Storage running against local emulator at: ${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`,
      );
    }
  }

  /**
   * Verifies a Firebase ID token received from the client during phone authentication.
   * Returns the verified phone number associated with the token.
   */
  async verifyPhoneToken(idToken: string): Promise<string> {
    try {
      const decodedToken = await getAuth(this.firebaseApp).verifyIdToken(
        idToken,
      );
      if (!decodedToken.phone_number) {
        throw new UnauthorizedException(
          'Firebase ID token does not contain a verified phone number.',
        );
      }
      return decodedToken.phone_number;
    } catch (error) {
      this.logger.error(
        `Failed to verify Firebase ID token: ${error instanceof Error ? error.message : error}`,
      );
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException(
        'Invalid or expired Firebase authentication token.',
      );
    }
  }

  getAuth(): Auth {
    return getAuth(this.firebaseApp);
  }

  getStorage(): Storage {
    return getStorage(this.firebaseApp);
  }

  getBucket() {
    return getStorage(this.firebaseApp).bucket();
  }
}
