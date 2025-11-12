import mongoose from 'mongoose';

const eventSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model('EventSetting', eventSettingSchema);

