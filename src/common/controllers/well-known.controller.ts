import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';

/**
 * Controller to handle well-known endpoints like security.txt
 */
@Controller('.well-known')
export class WellKnownController {
	@Get('security.txt')
	async getSecurityTxt(@Res() res: Response): Promise<void> {
		const securityTxt = `Contact: security@trustay.com
Expires: 2025-12-31T23:59:59.000Z
Encryption: https://trustay.com/pgp-key.txt
Acknowledgments: https://trustay.com/security/acknowledgments
Preferred-Languages: en, vi
Canonical: https://trustay.com/.well-known/security.txt
Policy: https://trustay.com/security/policy
`;

		res.setHeader('Content-Type', 'text/plain');
		res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
		res.send(securityTxt);
	}

	@Get('robots.txt')
	async getRobotsTxt(@Res() res: Response): Promise<void> {
		const robotsTxt = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /uploads/
Disallow: /images/

Sitemap: https://trustay.com/sitemap.xml
`;

		res.setHeader('Content-Type', 'text/plain');
		res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
		res.send(robotsTxt);
	}
}
