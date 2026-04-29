-- 建立 users 資料表，存放所有玩家的帳號資料
CREATE TABLE users (
  -- 主鍵，系統自動產生唯一 ID
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- 玩家自訂的遊戲 ID，不能重複
  custom_id text UNIQUE NOT NULL,
  
  -- 玩家的電子信箱，不能重複
  email text UNIQUE NOT NULL,
  
  -- 是否完成 Email 驗證，預設為尚未驗證
  is_verified bool DEFAULT false,
  
  -- 玩家持有的金幣數量，預設為0
  coins integer DEFAULT 0,
  
  -- 驗證用的 token，驗證完後會清空，格式：隨機亂碼.過期時間戳記
  verify_token text,
  
  -- 頭貼網址，NULL 代表使用預設頭貼（由前端處理）
  avatar_url text DEFAULT NULL,
  
  -- 帳號建立時間，系統自動填入
  created_at timestamptz DEFAULT now()
);

-- 開啟資料列層級安全控制，開啟後沒有符合規則的操作都會被拒絕
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 允許新增資料（註冊新帳號用，任何人都可以註冊）
CREATE POLICY "allow insert" ON public.users
FOR INSERT WITH CHECK (true);

-- 允許讀取資料（只能讀取自己的資料）
CREATE POLICY "allow select" ON public.users
FOR SELECT USING (auth.uid() = id);

-- 允許更新資料（只能更新自己的資料）
CREATE POLICY "allow update" ON public.users
FOR UPDATE USING (auth.uid() = id);