// 获取项目列表 - 修复版
app.get('/api/projects', async (req, res) => {
  try {
    console.log('[API /api/projects] 开始获取项目列表');
    const result = await pool.query('SELECT * FROM projects ORDER BY created_at DESC LIMIT 500');
    console.log('[API /api/projects] 查询到项目数:', result.rowCount);

    const projects = result.rows.map(row => {
      // 解析 JSONB 字段
      const digitalAssets = row.digital_assets ? (typeof row.digital_assets === 'string' ? JSON.parse(row.digital_assets) : row.digital_assets) : [];
      const stages = row.stages ? (typeof row.stages === 'string' ? JSON.parse(row.stages) : row.stages) : [];
      const teamMembers = row.team_members ? (typeof row.team_members === 'string' ? JSON.parse(row.team_members) : row.team_members) : [];
      const feishuExcludedMemberIds = row.feishu_excluded_member_ids ? (typeof row.feishu_excluded_member_ids === 'string' ? JSON.parse(row.feishu_excluded_member_ids) : row.feishu_excluded_member_ids) : [];
      const progress = row.progress ?? 0;
      
      console.log(`[API /api/projects] 项目 ${row.id} digitalAssets 数量:`, digitalAssets.length);

      // 手动构建返回对象，确保所有字段都包含
      return {
        id: row.id,
        name: row.name,
        clientName: row.client_name,
        projectType: row.project_type,
        area: row.area,
        location: row.location,
        city: row.city,
        country: row.country,
        coordinates: row.coordinates,
        status: row.status,
        description: row.description,
        imageUrl: row.image_url,
        brandId: row.brand_id,
        feishuDeptId: row.feishu_dept_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        // 关键字段
        digitalAssets,
        stages,
        teamMembers,
        feishuExcludedMemberIds,
        progress
      };
    });

    console.log('[API /api/projects] 返回项目数:', projects.length);
    console.log('[API /api/projects] 第一个项目 digitalAssets:', projects[0]?.digitalAssets?.length || 0);

    return res.json({
      code: 200,
      success: true,
      data: projects,
      msg: 'ok'
    });
  } catch (err) {
    console.error('项目列表接口错误', err);
    return res.status(500).json({ success: false, msg: '服务器错误' });
  }
});
