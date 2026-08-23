import { Module } from '@nestjs/common';
// TODO Phase 2: Admin panel endpoints
// - GET  /admin/businesses/pending  (verification queue)
// - PATCH /admin/businesses/:id/approve
// - GET  /admin/stats               (revenue, user counts)
// - Roles guard — ADMIN only
@Module({})
export class AdminModule {}
