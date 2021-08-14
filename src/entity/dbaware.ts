import {
  Column,
  ColumnOptions,
  ColumnType,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

const mysqlSqliteTypeMapping: {[key: string]: ColumnType} = {
  mediumtext: 'text',
  timestamp: 'datetime',
  timestamptz: 'datetime',
  mediumblob: 'blob',
  json: 'text',
  bytea: 'text',
};

export function setAppropriateColumnType(mySqlType: ColumnType): ColumnType {
  const isTestEnv = process.env.DB_USED === 'sqllite';
  if (isTestEnv && mySqlType in mysqlSqliteTypeMapping) {
    return mysqlSqliteTypeMapping[mySqlType.toString()];
  }
  return mySqlType;
}

export function DbAwareColumn(columnOptions: ColumnOptions) {
  if (columnOptions.type) {
    columnOptions.type = setAppropriateColumnType(columnOptions.type);
  }

  if (columnOptions.type === 'bytea') {
    columnOptions.type = 'text';
  }

  if (columnOptions.array) {
    columnOptions.type = 'text';
    columnOptions.array = false;
  }

  return Column(columnOptions);
}

export function DbAwareCreateDateColumn(columnOptions: ColumnOptions) {
  if (columnOptions.type) {
    columnOptions.type = setAppropriateColumnType(columnOptions.type);
  }
  return CreateDateColumn(columnOptions);
}

export function DbAwareUpdateDateColumn(columnOptions: ColumnOptions) {
  if (columnOptions.type) {
    columnOptions.type = setAppropriateColumnType(columnOptions.type);
  }
  return UpdateDateColumn(columnOptions);
}
