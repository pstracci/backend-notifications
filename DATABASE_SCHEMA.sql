-- ============================================
-- ESTRUTURA COMPLETA DO BANCO DE DADOS
-- Backend de Notificações Meteorológicas
-- Data: 21 de Outubro de 2025
-- ============================================

-- ============================================
-- TABELA: users
-- Armazena informações dos usuários
-- ============================================

CREATE TABLE public.users (
	id serial4 NOT NULL,
	uid varchar(255) NOT NULL,
	email varchar(255) NULL,
	"name" varchar(255) NULL,
	created_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
	latitude numeric(9, 6) NULL,
	longitude numeric(10, 6) NULL,
	location_updated_at timestamptz NULL,
	CONSTRAINT users_email_key UNIQUE (email),
	CONSTRAINT users_pkey PRIMARY KEY (id),
	CONSTRAINT users_uid_key UNIQUE (uid)
);

COMMENT ON TABLE public.users IS 'Usuários do sistema';
COMMENT ON COLUMN public.users.uid IS 'UID do Firebase Auth';
COMMENT ON COLUMN public.users.latitude IS 'Latitude da última localização do usuário';
COMMENT ON COLUMN public.users.longitude IS 'Longitude da última localização do usuário';
COMMENT ON COLUMN public.users.location_updated_at IS 'Timestamp da última atualização de localização';

-- ============================================
-- TABELA: devices
-- Armazena tokens FCM dos dispositivos
-- ============================================

CREATE TABLE public.devices (
	id serial4 NOT NULL,
	"token" text NOT NULL,
	created_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
	user_id int4 NULL,
	CONSTRAINT devices_pkey PRIMARY KEY (id),
	CONSTRAINT unique_user_token UNIQUE (user_id, token)
);

CREATE INDEX idx_devices_user_id ON public.devices USING btree (user_id);

ALTER TABLE public.devices ADD CONSTRAINT fk_device_user 
	FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

COMMENT ON TABLE public.devices IS 'Dispositivos e tokens FCM para notificações push';
COMMENT ON COLUMN public.devices.token IS 'Token FCM do dispositivo';
COMMENT ON COLUMN public.devices.user_id IS 'Referência ao usuário dono do dispositivo';

-- ============================================
-- TABELA: notification_cooldown
-- Controla cooldown de notificações por usuário e localização
-- ============================================

CREATE TABLE public.notification_cooldown (
	id serial4 NOT NULL,
	latitude numeric(10, 7) NOT NULL,
	longitude numeric(10, 7) NOT NULL,
	last_notification_at timestamp DEFAULT now() NOT NULL,
	created_at timestamp DEFAULT now() NULL,
	user_id int4 NOT NULL,
	alert_type text NOT NULL,
	"severity " text NULL,  -- ⚠️ ATENÇÃO: Tem espaço extra no final do nome!
	alert_value float4 NULL,
	CONSTRAINT notification_cooldown_pkey PRIMARY KEY (id),
	CONSTRAINT unique_user_location_alert UNIQUE (user_id, latitude, longitude, alert_type)
);

CREATE INDEX idx_cooldown_alert_type ON public.notification_cooldown USING btree (alert_type);
CREATE INDEX idx_cooldown_location ON public.notification_cooldown USING btree (latitude, longitude);
CREATE INDEX idx_cooldown_timestamp ON public.notification_cooldown USING btree (last_notification_at);
CREATE INDEX idx_cooldown_user ON public.notification_cooldown USING btree (user_id);

ALTER TABLE public.notification_cooldown ADD CONSTRAINT fk_cooldown_user 
	FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

COMMENT ON TABLE public.notification_cooldown IS 'Controla cooldown de 1 hora para notificações por usuário, região e tipo de alerta';
COMMENT ON COLUMN public.notification_cooldown.user_id IS 'ID do usuário que recebeu a notificação';
COMMENT ON COLUMN public.notification_cooldown.latitude IS 'Latitude da região (arredondada para 2 casas decimais)';
COMMENT ON COLUMN public.notification_cooldown.longitude IS 'Longitude da região (arredondada para 2 casas decimais)';
COMMENT ON COLUMN public.notification_cooldown.alert_type IS 'Tipo do alerta (rain_now, air_quality, wind, uv_high, temperature)';
COMMENT ON COLUMN public.notification_cooldown."severity " IS 'Severidade do alerta (light, moderate, heavy, extreme, etc)';
COMMENT ON COLUMN public.notification_cooldown.alert_value IS 'Valor numérico do alerta (ex: mm de chuva, índice UV, AQI, km/h de vento)';
COMMENT ON COLUMN public.notification_cooldown.last_notification_at IS 'Timestamp da última notificação enviada';

-- ============================================
-- TABELA: procedures
-- Armazena procedimentos/tarefas dos usuários
-- ============================================

CREATE TABLE public."procedures" (
	id serial4 NOT NULL,
	user_id int4 NOT NULL,
	title varchar(255) NOT NULL,
	description text NULL,
	status varchar(50) DEFAULT 'pending'::character varying NULL,
	created_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT procedures_pkey PRIMARY KEY (id)
);

ALTER TABLE public."procedures" ADD CONSTRAINT procedures_user_id_fkey 
	FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

COMMENT ON TABLE public."procedures" IS 'Procedimentos ou tarefas associadas aos usuários';

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================

-- ⚠️ PROBLEMA CRÍTICO IDENTIFICADO:
-- A coluna "severity " na tabela notification_cooldown tem um ESPAÇO EXTRA no final do nome!
-- Isso causa erro ao tentar inserir dados com o nome "severity" (sem espaço).
-- 
-- SOLUÇÃO: Execute a migration de correção para renomear a coluna.
