import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth, withErrorHandler } from '@/server/middleware';
import { query } from '@/lib/db';
import type { ApiResponse } from '@/types';

export const DELETE = withErrorHandler(
  withAdminAuth(async (_req: NextRequest, ctx: unknown) => {
    const { params } = ctx as { params: { id: string; messageId: string } };
    const { rows } = await query(
      `DELETE FROM circle_messages WHERE id = $1 AND circle_id = $2 RETURNING id`,
      [params.messageId, params.id]
    );
    if (rows.length === 0) {
      return NextResponse.json<ApiResponse<never>>({ success: false, error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json<ApiResponse<{ deleted: boolean }>>({ success: true, data: { deleted: true } });
  })
);
