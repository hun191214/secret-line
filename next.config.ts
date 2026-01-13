import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  // 기존 설정 유지
  webpack: (config) => {
    config.plugins = config.plugins || [];
    // 백엔드 관련 폴더/파일 번들 제외
    config.plugins.push(
      new config.webpack.IgnorePlugin({
        resourceRegExp: /(_backup_hold|nest|nestjs|server|backend)/
      })
    );
    return config;
  }
};

export default withNextIntl(nextConfig);
